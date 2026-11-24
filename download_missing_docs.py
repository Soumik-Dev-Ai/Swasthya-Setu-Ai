import os
import requests
import urllib3
import time

# Suppress insecure request warnings for self-signed government certs
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Target directories
RAW_DIR = r"c:\Users\user\projects\SwasthaSetu Ai\docs_raw"
FINANCIAL_DIR = os.path.join(RAW_DIR, "financial")

os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(FINANCIAL_DIR, exist_ok=True)

# Required documents with their direct URLs and strict target filenames
# Using known MoHFW/NHM and WHO IRIS direct bitstream links
DOWNLOAD_TASKS = [
    {
        "url": "https://iris.who.int/bitstream/handle/10665/43386/9241546875_eng.pdf",
        "path": os.path.join(RAW_DIR, "who_etat_manual.pdf"),
        "name": "WHO ETAT Manual"
    },
    {
        "url": "https://nhm.gov.in/images/pdf/programmes/jsy/guidelines/jsy_guidelines.pdf",
        "path": os.path.join(FINANCIAL_DIR, "jsy_guidelines_2024-01.pdf"),
        "name": "Janani Suraksha Yojana (JSY) Guidelines"
    },
    {
        "url": "https://nhm.gov.in/New_Updates_2018/NHM_Components/PMNDP/Guidelines/PMNDP_Guidelines.pdf",
        "path": os.path.join(FINANCIAL_DIR, "pmndp_dialysis_guidelines_2024-01.pdf"),
        "name": "PMNDP Dialysis Guidelines"
    },
    {
        "url": "https://mohfw.gov.in/sites/default/files/RAN%20Guidelines.pdf",
        "path": os.path.join(FINANCIAL_DIR, "hmdg_ran_guidelines_2024-01.pdf"),
        "name": "HMDG / RAN Guidelines"
    }
]

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

def download_file(task):
    print(f"Attempting to download {task['name']}...")
    try:
        # verify=False is critical here due to strict Indian Govt NIC SSL firewalls
        response = requests.get(task["url"], headers=headers, verify=False, timeout=20)
        
        if response.status_code == 200:
            if "application/pdf" in response.headers.get("Content-Type", "") or response.content.startswith(b'%PDF'):
                with open(task["path"], "wb") as f:
                    f.write(response.content)
                print(f"[SUCCESS] Downloaded and correctly named: {os.path.basename(task['path'])}")
            else:
                print(f"[ERROR] Downloaded file for {task['name']} does not appear to be a PDF.")
        elif response.status_code == 404:
            print(f"[ERROR] 404 Not Found for {task['name']} - URL might have changed.")
        else:
            print(f"[ERROR] Failed to download {task['name']}. Status Code: {response.status_code}")
            
    except requests.exceptions.Timeout:
        print(f"[TIMEOUT] Connection timed out for {task['name']}. Government server is unresponsive.")
    except Exception as e:
        print(f"[FAILED] Error downloading {task['name']}: {str(e)}")

print("Starting automated data acquisition pipeline...")
for task in DOWNLOAD_TASKS:
    download_file(task)
    time.sleep(2) # Be polite to gov servers

print("\nTask complete. Verify your docs_raw folders.")
