import os
import requests
from backend.db import get_app_data_dir

def download_pexels_broll(query: str, api_key: str, output_path: str) -> bool:
    """Download a portrait video from Pexels based on the query."""
    if not query or not api_key:
        return False
        
    url = "https://api.pexels.com/videos/search"
    headers = {
        "Authorization": api_key
    }
    params = {
        "query": query,
        "orientation": "portrait",
        "per_page": 1,
        "size": "medium"
    }
    
    try:
        res = requests.get(url, headers=headers, params=params, timeout=10)
        res.raise_for_status()
        data = res.json()
        
        videos = data.get("videos", [])
        if not videos:
            return False
            
        video = videos[0]
        video_files = video.get("video_files", [])
        
        # Cari file HD dengan format MP4
        download_url = ""
        for vf in video_files:
            if vf.get("quality") == "hd" and vf.get("file_type") == "video/mp4":
                download_url = vf.get("link")
                break
                
        if not download_url and video_files:
            download_url = video_files[0].get("link")
            
        if not download_url:
            return False
            
        # Download the video
        video_res = requests.get(download_url, stream=True, timeout=30)
        video_res.raise_for_status()
        
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'wb') as f:
            for chunk in video_res.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
                    
        return True
    except Exception as e:
        print(f"Failed to fetch B-Roll for query '{query}': {e}")
        return False
