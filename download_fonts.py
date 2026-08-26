import urllib.request
import re
import os

fonts = ['Montserrat', 'Bebas Neue', 'Poppins', 'Oswald', 'Anton', 'Permanent Marker', 'Roboto']
os.makedirs('backend/fonts', exist_ok=True)

# Important: Must pretend to be a non-WOFF2 browser (like old Safari or curl) 
# so Google returns .ttf instead of .woff2 in the CSS.
headers = {
    'User-Agent': 'curl/7.68.0' 
}

for font in fonts:
    print(f'Downloading {font}...')
    css_url = f'https://fonts.googleapis.com/css2?family={font.replace(" ", "+")}'
    req = urllib.request.Request(css_url, headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            css = response.read().decode('utf-8')
            
            # Find the first url(...)
            match = re.search(r'src:\s*url\((.*?\.ttf)\)', css)
            if not match:
                print(f"Could not find .ttf URL in CSS for {font}")
                continue
                
            ttf_url = match.group(1)
            print(f"Found TTF URL: {ttf_url}")
            
            ttf_req = urllib.request.Request(ttf_url, headers=headers)
            with urllib.request.urlopen(ttf_req) as ttf_resp:
                filename = font.replace(" ", "") + ".ttf"
                with open(os.path.join('backend/fonts', filename), 'wb') as f:
                    f.write(ttf_resp.read())
            print(f'{font} downloaded as {filename}.')
    except Exception as e:
        print(f'Failed to download {font}: {e}')
