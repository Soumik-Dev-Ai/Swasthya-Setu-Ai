import os
import requests
import asyncio
from urllib.parse import urljoin
from playwright.async_api import async_playwright

output_dir = r"c:\Users\user\projects\SwasthaSetu Ai\docs_raw\financial"
os.makedirs(output_dir, exist_ok=True)

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        print("Navigating to NHA portal...")
        
        # Navigate and wait for the network to idle
        try:
            await page.goto("https://nha.gov.in/DocumentsResource", wait_until="networkidle", timeout=30000)
        except Exception as e:
            print(f"Navigation error: {e}")
            
        # Give React extra time to fetch its API and render the table
        await page.wait_for_timeout(8000)
        
        print("Extracting PDF links from the DOM...")
        hrefs = await page.evaluate('''() => {
            const links = Array.from(document.querySelectorAll('a'));
            return links
                .map(a => a.href)
                .filter(href => href && href.toLowerCase().includes('.pdf'));
        }''')
        
        hrefs = list(set(hrefs)) # deduplicate
        print(f"Found {len(hrefs)} unique PDF links.")
        
        if len(hrefs) == 0:
            print("Trying to click pagination or wait longer to see if docs load...")
        
        for url in hrefs:
            filename = url.split('/')[-1].split('?')[0]
            if not filename.endswith('.pdf'):
                filename += '.pdf'
                
            filepath = os.path.join(output_dir, filename)
            print(f"Downloading {filename}...")
            try:
                response = requests.get(url, timeout=15)
                if response.status_code == 200:
                    with open(filepath, 'wb') as f:
                        f.write(response.content)
            except Exception as e:
                print(f"Failed to download {url}: {e}")
                
        await browser.close()
        print("Scraping complete.")

if __name__ == "__main__":
    asyncio.run(run())
