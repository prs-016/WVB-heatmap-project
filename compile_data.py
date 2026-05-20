import os
import json
import glob
import pandas as pd
import numpy as np

def clean_val(val):
    if pd.isna(val) or val is None:
        return None
    if isinstance(val, (np.integer, int)):
        return int(val)
    if isinstance(val, (np.floating, float)):
        return float(val)
    return str(val)

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_dir = os.path.join(script_dir, "public", "data", "interim_csv")
    metadata_path = os.path.join(script_dir, "public", "data", "match_metadata.json")
    output_json_path = os.path.join(script_dir, "public", "data", "dashboard_data.json")

    if not os.path.exists(metadata_path):
        print(f"Error: Metadata not found at {metadata_path}")
        return

    with open(metadata_path, 'r') as f:
        metadata = json.load(f)

    csv_files = glob.glob(os.path.join(csv_dir, "*.csv"))
    if not csv_files:
        print(f"No CSV files found in {csv_dir}")
        return

    print(f"Found {len(csv_files)} CSV files. Compiling dashboard data...")

    compiled_matches = {}
    total_events = 0

    for csv_file in csv_files:
        base_csv = os.path.basename(csv_file).replace(".csv", "")
        
        # Find corresponding match in metadata
        match_id = None
        match_info = None
        for m_id, info in metadata.items():
            dvw_path = info.get("dvw_path", "")
            csv_path = info.get("csv_path", "")
            if base_csv in dvw_path or base_csv in csv_path:
                match_id = m_id
                match_info = info
                break
        
        if not match_id:
            print(f"  -> Warning: No metadata match found for {os.path.basename(csv_file)}")
            continue

        opponent = match_info.get("opponent", "Unknown Opponent")
        date = match_info.get("date", "Unknown Date")
        stream_url = match_info.get("stream_url", "")

        df = pd.read_csv(csv_file)
        
        # We only care about UCSD events (team_id == 1378 or team == "University of California, San Diego")
        # and we must have a valid video_time and at least a start coordinate
        ucsd_df = df[
            (df['team_id'] == 1378) & 
            (df['video_time'].notna()) & 
            (df['start_coordinate_x'].notna()) & 
            (df['start_coordinate_y'].notna())
        ]

        if ucsd_df.empty:
            continue

        events_list = []
        for _, row in ucsd_df.iterrows():
            # Get video_time in seconds
            v_time = clean_val(row['video_time'])
            if v_time is None or v_time <= 0:
                continue

            event = {
                "point_id": clean_val(row.get('point_id')),
                "skill": clean_val(row.get('skill')),
                "skill_type": clean_val(row.get('skill_type')),
                "player_name": clean_val(row.get('player_name')),
                "player_number": clean_val(row.get('player_number')),
                "evaluation": clean_val(row.get('evaluation')),
                "evaluation_code": clean_val(row.get('evaluation_code')),
                "video_time": v_time,
                "start_x": clean_val(row.get('start_coordinate_x')),
                "start_y": clean_val(row.get('start_coordinate_y')),
                "end_x": clean_val(row.get('end_coordinate_x')),
                "end_y": clean_val(row.get('end_coordinate_y')),
                "home_score": clean_val(row.get('home_team_score')),
                "visiting_score": clean_val(row.get('visiting_team_score')),
                "set_number": clean_val(row.get('set_number')),
            }
            events_list.append(event)
            total_events += 1

        if events_list:
            compiled_matches[match_id] = {
                "match_id": match_id,
                "opponent": opponent,
                "date": date,
                "stream_url": stream_url,
                "events": events_list
            }
            print(f"  -> Compiled {len(events_list)} UCSD events for vs. {opponent} (Match ID: {match_id})")

    # Save to file
    with open(output_json_path, 'w') as f:
        json.dump(compiled_matches, f, indent=2)

    print(f"\nSuccess! Compiled {total_events} events across {len(compiled_matches)} matches.")
    print(f"Data saved to: {output_json_path}")

if __name__ == "__main__":
    main()
