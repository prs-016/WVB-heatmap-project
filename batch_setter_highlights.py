import pandas as pd
import os
import subprocess
import json
import glob
import shutil
import sys
from datetime import datetime

"""
BATCH SETTER HIGHLIGHTS GENERATOR
=================================
This script generates highlight clips for UCSD setters from all processed match data.
It specifically filters for sets that occurred after a '#' (Perfect) or '+' (Positive) pass.

Prerequisites:
1. Python 3.x
2. pandas (pip install pandas)
3. ffmpeg installed and in your system PATH.

Usage:
    python batch_setter_highlights.py --output_dir my_highlights
"""

def find_ffmpeg():
    """Locates ffmpeg executable."""
    found = shutil.which("ffmpeg")
    if found:
        return found
    # Common locations on Windows if not in PATH
    conda_prefix = os.environ.get("CONDA_PREFIX", "")
    if conda_prefix:
        win_path = os.path.join(conda_prefix, "Library", "bin", "ffmpeg.exe")
        if os.path.exists(win_path):
            return win_path
    return "ffmpeg" # Fallback to command name

def get_stream_url(csv_filename, metadata):
    """Maps a CSV filename to a CloudFront stream URL using match_metadata.json."""
    base_csv = os.path.basename(csv_filename).replace(".csv", "")
    for match_id, info in metadata.items():
        # Check dvw_path or csv_path in metadata for a match
        dvw_path = info.get("dvw_path", "")
        csv_path = info.get("csv_path", "")
        if base_csv in dvw_path or base_csv in csv_path:
            return info.get("stream_url")
    return None

def process_match(csv_path, stream_url, output_dir, team_id=1378):
    """Analyzes a match CSV and generates clips for the setter."""
    df = pd.read_csv(csv_path)
    
    # 1. Identify the primary setter for the team
    setter_counts = df[(df['team_id'] == team_id) & (df['skill'] == 'Set')]['player_name'].value_counts()
    if setter_counts.empty:
        print(f"  -> No sets found for Team {team_id} in this match.")
        return
    
    setter_name = setter_counts.index[0]
    print(f"  -> Identified primary setter: {setter_name} ({setter_counts[0]} total sets)")

    # 2. Filter for Sets following # or + passes
    # We iterate through the dataframe and track the quality of the last reception in the rally
    target_sets = []
    
    # Group by point_id (rally)
    for point_id, rally in df.groupby('point_id'):
        last_rec_quality = None
        for _, row in rally.iterrows():
            if row['skill'] == 'Reception' and row['team_id'] == team_id:
                last_rec_quality = row['evaluation_code']
            
            if row['skill'] == 'Set' and row['player_name'] == setter_name:
                if last_rec_quality in ['#', '+']:
                    # We found a target set!
                    target_sets.append({
                        'time': row['video_time'],
                        'quality': last_rec_quality,
                        'point': point_id
                    })
                # Reset quality after a set if you only want the "first ball" sets, 
                # but usually teams want all sets after good passes. 
                # For now, we'll keep the last_rec_quality for the whole rally unless another reception happens.
    
    if not target_sets:
        print(f"  -> No sets found following # or + passes.")
        return

    print(f"  -> Found {len(target_sets)} candidate clips. Generating...")

    # 3. Generate Clips
    ffmpeg_bin = find_ffmpeg()
    match_name = os.path.basename(csv_path).replace(".csv", "")
    match_out_dir = os.path.join(output_dir, match_name)
    os.makedirs(match_out_dir, exist_ok=True)

    count = 0
    for s in target_sets:
        try:
            timestamp = float(s['time'])
            if pd.isna(timestamp) or timestamp <= 0:
                continue
                
            start_time = max(0, timestamp - 5)
            duration = 7
            
            filename = f"set_P{s['point']}_Q{s['quality'].replace('#', 'perf').replace('+', 'pos')}.mp4"
            output_file = os.path.join(match_out_dir, filename)
            
            # FFmpeg call
            cmd = [
                ffmpeg_bin,
                "-ss", str(start_time),
                "-t", str(duration),
                "-i", stream_url,
                "-c", "copy",
                "-y",
                output_file
            ]
            
            # Run silently
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            count += 1
        except Exception as e:
            pass

    print(f"  -> Done! Generated {count} clips in {match_out_dir}")

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Generate batch setter highlights for UCSD.")
    parser.add_argument("--output_dir", default="setter_highlights", help="Directory to save clips.")
    parser.add_argument("--team_id", type=int, default=1378, help="Team ID for UCSD (default 1378).")
    args = parser.parse_args()

    # Paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_dir = os.path.join(script_dir, "public", "data", "interim_csv")
    metadata_path = os.path.join(script_dir, "public", "data", "match_metadata.json")

    if not os.path.exists(metadata_path):
        print(f"Error: Metadata not found at {metadata_path}. Please run the capture agent first.")
        return

    with open(metadata_path, 'r') as f:
        metadata = json.load(f)

    csv_files = glob.glob(os.path.join(csv_dir, "*.csv"))
    if not csv_files:
        print(f"No CSV files found in {csv_dir}.")
        return

    print(f"Found {len(csv_files)} matches to process.")
    
    for csv_file in csv_files:
        print(f"\nProcessing {os.path.basename(csv_file)}...")
        url = get_stream_url(csv_file, metadata)
        if not url:
            print("  -> Skip: No stream URL found in metadata.")
            continue
        
        process_match(csv_file, url, args.output_dir, team_id=args.team_id)

    print("\nBatch process complete!")

if __name__ == "__main__":
    main()
