"""
NYC MarketProof Building Scraper
Scrapes building information including overview, violations, and building footprint
Targets: Address, Zip Code, Borough, Building Type, Floors, Number of Units, Year Built
Violation Metrics: DOB Violations, ECB Violations, HPD Violations, DOB Complaints
"""

import time
import json
import os
import re
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from datetime import datetime
from PIL import Image


class NYCBuildingScraper:
    def __init__(self, headless=False):
        """Initialize the scraper with Chrome webdriver"""
        chrome_options = Options()
        if headless:
            chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_argument('--window-size=1920,1080')
        chrome_options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

        # Use webdriver-manager to automatically handle ChromeDriver
        service = Service(ChromeDriverManager().install())
        self.driver = webdriver.Chrome(service=service, options=chrome_options)
        self.wait = WebDriverWait(self.driver, 15)

    def scrape_building(self, url):
        """
        Scrape building data from a MarketProof URL

        Args:
            url: Full URL to the building page

        Returns:
            dict: Building data including overview, violations, and footprint
        """
        print(f"\n{'='*60}")
        print(f"Scraping: {url}")
        print(f"{'='*60}\n")

        # Extract address from URL for use in filename
        url_address = self._extract_address_from_url(url)

        building_data = {
            'url': url,
            'scraped_at': datetime.now().isoformat(),
            'building_info': {'address': url_address},  # Pre-populate with URL address
            'violations': {},
            'building_footprint_url': None
        }

        # Navigate to overview tab first
        overview_url = self._construct_tab_url(url, 'overview')
        self.driver.get(overview_url)
        time.sleep(5)

        # Scrape overview information (will update address if found on page)
        scraped_info = self._scrape_overview()
        building_data['building_info'].update(scraped_info)

        # Ensure we have the URL address if page scraping didn't find one
        if not building_data['building_info'].get('address'):
            building_data['building_info']['address'] = url_address

        # Get building footprint photo from overview tab
        building_data['building_footprint_url'] = self._get_footprint_image()

        # Scrape violations by navigating to violations URL
        building_data['violations'] = self._scrape_violations(url)

        return building_data

    def _extract_address_from_url(self, url):
        """
        Extract address from MarketProof URL
        Example: https://nyc.marketproof.com/building/manhattan/midtown/110-west-57-street-10019?tab=details
        Returns: "110 West 57 Street 10019"
        """
        try:
            # Get the path part after /building/borough/neighborhood/
            parts = url.split('/')
            if 'building' in parts:
                building_index = parts.index('building')
                # Address is typically 3 positions after 'building'
                if len(parts) > building_index + 3:
                    address_part = parts[building_index + 3]
                    # Remove query parameters
                    address_part = address_part.split('?')[0]
                    # Convert hyphens to spaces and title case
                    address = address_part.replace('-', ' ').title()
                    return address
        except Exception as e:
            print(f"Could not extract address from URL: {e}")

        return "Unknown Address"

    def _construct_tab_url(self, base_url, tab_name):
        """Construct URL with specific tab parameter"""
        if '?tab=' in base_url:
            return re.sub(r'\?tab=\w+', f'?tab={tab_name}', base_url)
        else:
            return base_url.rstrip('/') + f'?tab={tab_name}'

    def _scrape_overview(self):
        """Scrape overview tab information - focusing on specific fields"""
        print("Extracting building overview data...")

        overview_data = {
            'address': None,
            'zip_code': None,
            'borough': None,
            'building_type': None,
            'floors': None,
            'number_of_units': None,
            'year_built': None
        }

        try:
            # Save page source for debugging
            try:
                with open('debug_page_source.html', 'w', encoding='utf-8') as f:
                    f.write(self.driver.page_source)
                print("✓ Page source saved to debug_page_source.html")
            except Exception as e:
                print(f"✗ Could not save page source: {e}")

            # Take a screenshot for debugging
            try:
                self.driver.save_screenshot('debug_screenshot.png')
                print("✓ Screenshot saved to debug_screenshot.png")
            except:
                pass

            # Strategy 1: Extract from page text
            print("\n--- Strategy 1: Text parsing ---")
            body_text = self.driver.find_element(By.TAG_NAME, 'body').text
            lines = [line.strip() for line in body_text.split('\n') if line.strip()]

            # Look for data patterns in text
            for i, line in enumerate(lines):
                line_lower = line.lower()
                next_line = lines[i + 1] if i + 1 < len(lines) else ""

                # Borough detection
                if line in ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island']:
                    if not overview_data['borough']:
                        overview_data['borough'] = line
                        print(f"  Found Borough: {line}")

                # Year built
                if 'year built' in line_lower or line_lower == 'built':
                    year_match = re.search(r'\b(19|20)\d{2}\b', next_line)
                    if year_match and not overview_data['year_built']:
                        overview_data['year_built'] = year_match.group(0)
                        print(f"  Found Year Built: {year_match.group(0)}")

                # Floors/Stories
                if 'floors' in line_lower or 'stories' in line_lower:
                    num_match = re.search(r'\b(\d+)\b', next_line)
                    if num_match and not overview_data['floors']:
                        overview_data['floors'] = num_match.group(0)
                        print(f"  Found Floors: {num_match.group(0)}")

                # Units
                if 'units' in line_lower and 'number' in line_lower:
                    num_match = re.search(r'\b(\d+)\b', next_line)
                    if num_match and not overview_data['number_of_units']:
                        overview_data['number_of_units'] = num_match.group(0)
                        print(f"  Found Units: {num_match.group(0)}")

                # Building type
                if 'building type' in line_lower or 'property type' in line_lower:
                    if next_line and not overview_data['building_type']:
                        overview_data['building_type'] = next_line
                        print(f"  Found Building Type: {next_line}")

                # Zip code
                zip_match = re.search(r'\b\d{5}(?:-\d{4})?\b', line)
                if zip_match and not overview_data['zip_code']:
                    overview_data['zip_code'] = zip_match.group(0)
                    print(f"  Found Zip Code: {zip_match.group(0)}")

            # Strategy 2: Try to find H1 for address
            print("\n--- Strategy 2: Header extraction ---")
            try:
                h1 = self.driver.find_element(By.TAG_NAME, 'h1')
                address_text = h1.text.strip()
                if address_text and not overview_data['address']:
                    overview_data['address'] = address_text
                    print(f"  Found Address in H1: {address_text}")
            except:
                pass

            # Strategy 3: Look for structured data in divs/spans
            print("\n--- Strategy 3: Structured element search ---")
            try:
                # Find all divs that might contain key-value pairs
                all_divs = self.driver.find_elements(By.TAG_NAME, 'div')

                for div in all_divs:
                    try:
                        text = div.text.strip()
                        if not text or len(text) > 200:
                            continue

                        # Check if this looks like a label-value pair
                        if '\n' in text:
                            parts = text.split('\n')
                            if len(parts) == 2:
                                label, value = parts[0].strip(), parts[1].strip()
                                label_lower = label.lower()

                                if 'year built' in label_lower and not overview_data['year_built']:
                                    overview_data['year_built'] = value
                                    print(f"  Found Year Built: {value}")
                                elif 'floors' in label_lower and not overview_data['floors']:
                                    overview_data['floors'] = value
                                    print(f"  Found Floors: {value}")
                                elif 'units' in label_lower and not overview_data['number_of_units']:
                                    overview_data['number_of_units'] = value
                                    print(f"  Found Units: {value}")
                                elif 'type' in label_lower and not overview_data['building_type']:
                                    overview_data['building_type'] = value
                                    print(f"  Found Building Type: {value}")
                                elif 'borough' in label_lower and not overview_data['borough']:
                                    overview_data['borough'] = value
                                    print(f"  Found Borough: {value}")
                    except:
                        continue
            except Exception as e:
                print(f"  Error in structured search: {e}")

            # Strategy 4: Extract from URL if address still missing
            if not overview_data['address']:
                try:
                    url_parts = self.driver.current_url.split('/')
                    for part in url_parts:
                        if '-' in part and any(c.isdigit() for c in part) and 'building' not in part.lower():
                            address_candidate = part.replace('-', ' ').title()
                            overview_data['address'] = address_candidate
                            print(f"  Extracted Address from URL: {address_candidate}")
                            break
                except:
                    pass

            # Print summary
            print(f"\n{'='*60}")
            print("EXTRACTED DATA SUMMARY:")
            print(f"{'='*60}")
            for key, value in overview_data.items():
                status = "✓" if value else "✗"
                print(f"{status} {key.replace('_', ' ').title()}: {value if value else 'NOT FOUND'}")
            print(f"{'='*60}\n")

        except Exception as e:
            print(f"Error scraping overview: {e}")
            import traceback
            traceback.print_exc()

        return overview_data

    def _get_footprint_image(self, output_dir='scraped_buildings'):
        """Screenshot the Mapbox canvas building footprint and crop out button"""
        print("\nExtracting building footprint image...")

        try:
            # Wait for map to render
            time.sleep(3)

            # Find the Mapbox canvas element
            canvas = self.driver.find_element(By.CSS_SELECTOR, 'canvas.mapboxgl-canvas')

            if canvas:
                print("✓ Found Mapbox canvas element")
                os.makedirs(output_dir, exist_ok=True)

                # Generate filename
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                temp_path = os.path.join(output_dir, f'footprint_temp_{timestamp}.png')
                screenshot_path = os.path.join(output_dir, f'footprint_{timestamp}.png')

                # Take screenshot
                canvas.screenshot(temp_path)
                print("✓ Captured footprint screenshot")

                # Crop bottom 50px to remove button
                img = Image.open(temp_path)
                width, height = img.size
                cropped_img = img.crop((0, 0, width, height - 50))
                cropped_img.save(screenshot_path)
                print(f"✓ Cropped and saved: {screenshot_path}")

                # Delete temp file
                os.remove(temp_path)

                return screenshot_path
            else:
                print("✗ No Mapbox canvas found")
                return None

        except Exception as e:
            print(f"Error getting footprint image: {e}")
            import traceback
            traceback.print_exc()
            return None


    def _scrape_violations(self, base_url):
        """Navigate to violations tab and extract violation counts"""
        print("\nExtracting violations data...")

        violations_data = {
            'dob_violations': None,
            'ecb_violations': None,
            'hpd_violations': None,
            'dob_complaints': None
        }

        try:
            # Construct violations URL
            violations_url = self._construct_tab_url(base_url, 'violations')

            print(f"Navigating to: {violations_url}")
            self.driver.get(violations_url)
            time.sleep(5)  # Wait for page to load

            # Save violations page source for debugging
            try:
                with open('debug_violations_source.html', 'w', encoding='utf-8') as f:
                    f.write(self.driver.page_source)
                print("✓ Violations page source saved to debug_violations_source.html")
            except:
                pass

            # Extract violations data from page text
            body_text = self.driver.find_element(By.TAG_NAME, 'body').text
            lines = [line.strip() for line in body_text.split('\n') if line.strip()]

            # Look for specific violation types
            for i, line in enumerate(lines):
                line_lower = line.lower()
                next_line = lines[i + 1] if i + 1 < len(lines) else ""

                # DOB Violations
                if 'dob violations' in line_lower or 'dob violation' in line_lower:
                    num_match = re.search(r'\b(\d+)\b', next_line)
                    if num_match:
                        violations_data['dob_violations'] = num_match.group(0)
                        print(f"  Found DOB Violations: {num_match.group(0)}")
                    # Check if number is in the same line
                    num_match = re.search(r'\b(\d+)\b', line)
                    if num_match and not violations_data['dob_violations']:
                        violations_data['dob_violations'] = num_match.group(0)
                        print(f"  Found DOB Violations: {num_match.group(0)}")

                # ECB Violations
                if 'ecb violations' in line_lower or 'ecb violation' in line_lower:
                    num_match = re.search(r'\b(\d+)\b', next_line)
                    if num_match:
                        violations_data['ecb_violations'] = num_match.group(0)
                        print(f"  Found ECB Violations: {num_match.group(0)}")
                    num_match = re.search(r'\b(\d+)\b', line)
                    if num_match and not violations_data['ecb_violations']:
                        violations_data['ecb_violations'] = num_match.group(0)
                        print(f"  Found ECB Violations: {num_match.group(0)}")

                # HPD Violations
                if 'hpd violations' in line_lower or 'hpd violation' in line_lower:
                    num_match = re.search(r'\b(\d+)\b', next_line)
                    if num_match:
                        violations_data['hpd_violations'] = num_match.group(0)
                        print(f"  Found HPD Violations: {num_match.group(0)}")
                    num_match = re.search(r'\b(\d+)\b', line)
                    if num_match and not violations_data['hpd_violations']:
                        violations_data['hpd_violations'] = num_match.group(0)
                        print(f"  Found HPD Violations: {num_match.group(0)}")

                # DOB Complaints
                if 'dob complaints' in line_lower or 'dob complaint' in line_lower:
                    num_match = re.search(r'\b(\d+)\b', next_line)
                    if num_match:
                        violations_data['dob_complaints'] = num_match.group(0)
                        print(f"  Found DOB Complaints: {num_match.group(0)}")
                    num_match = re.search(r'\b(\d+)\b', line)
                    if num_match and not violations_data['dob_complaints']:
                        violations_data['dob_complaints'] = num_match.group(0)
                        print(f"  Found DOB Complaints: {num_match.group(0)}")

            # Print summary
            print(f"\n{'='*60}")
            print("VIOLATIONS SUMMARY:")
            print(f"{'='*60}")
            for key, value in violations_data.items():
                status = "✓" if value else "✗"
                print(f"{status} {key.replace('_', ' ').title()}: {value if value else 'NOT FOUND'}")
            print(f"{'='*60}\n")

        except Exception as e:
            print(f"Error scraping violations: {e}")
            import traceback
            traceback.print_exc()

        return violations_data

    def save_data(self, building_data, output_dir='scraped_buildings'):
        """Save scraped data to JSON"""
        os.makedirs(output_dir, exist_ok=True)

        # Create safe filename
        address = building_data['building_info'].get('address') or 'unknown_building'
        if address:
            safe_name = re.sub(r'[^\w\s-]', '', address)
            safe_name = re.sub(r'[-\s]+', '_', safe_name).strip('_')
        else:
            safe_name = 'unknown_building'

        # Fallback to timestamp if still empty
        if not safe_name or safe_name == '':
            safe_name = f'building_{datetime.now().strftime("%Y%m%d_%H%M%S")}'

        # Save JSON data
        json_path = os.path.join(output_dir, f'{safe_name}.json')
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(building_data, f, indent=2, ensure_ascii=False)
        print(f"\n✓ Data saved to: {json_path}")

        return json_path

    def close(self):
        """Close the browser"""
        self.driver.quit()
    def address_to_url(self, address, zip_code=None):
        """
        Convert NYC address to MarketProof URL format

        Args:
            address: Street address (e.g., "110 West 57 Street")
            zip_code: Optional ZIP code (e.g., "10019")

        Returns:
            str: MarketProof URL
        """
        # Clean and format address
        address_clean = address.lower().strip()

        # Replace common abbreviations
        replacements = {
            ' street': '-street',
            ' st': '-street',
            ' avenue': '-avenue',
            ' ave': '-avenue',
            ' road': '-road',
            ' rd': '-road',
            ' boulevard': '-boulevard',
            ' blvd': '-boulevard',
            ' place': '-place',
            ' pl': '-place',
            ' drive': '-drive',
            ' dr': '-drive',
            'east ': 'east-',
            'west ': 'west-',
            'north ': 'north-',
            'south ': 'south-',
        }

        for old, new in replacements.items():
            address_clean = address_clean.replace(old, new)

        # Replace spaces with hyphens
        address_clean = address_clean.replace(' ', '-')

        # Remove special characters except hyphens
        address_clean = re.sub(r'[^\w\-]', '', address_clean)

        # Default borough to manhattan if not specified
        borough = 'manhattan'
        neighborhood = 'midtown'

        # Construct URL
        if zip_code:
            url = f"https://nyc.marketproof.com/building/{borough}/{neighborhood}/{address_clean}-{zip_code}?tab=details"
        else:
            url = f"https://nyc.marketproof.com/building/{borough}/{neighborhood}/{address_clean}?tab=details"

        return url

    def scrape_by_address(self, address, zip_code=None):
        """
        Scrape building data using NYC address

        Args:
            address: Street address (e.g., "110 West 57 Street")
            zip_code: Optional ZIP code (e.g., "10019")

        Returns:
            dict: Building data
        """
        url = self.address_to_url(address, zip_code)
        print(f"Generated URL: {url}")
        return self.scrape_building(url)



def main():
    # Example usage - can use either URL or address

    # Option 1: Use direct URL
    # url = "https://nyc.marketproof.com/building/manhattan/midtown/110-west-57-street-10019?tab=details"
    # scraper = NYCBuildingScraper(headless=False)
    # building_data = scraper.scrape_building(url)

    # Option 2: Use address
    address = "110 West 57 Street"
    zip_code = "10019"

    scraper = NYCBuildingScraper(headless=False)  # Set to True for headless mode

    try:
        building_data = scraper.scrape_by_address(address, zip_code)
        output_file = scraper.save_data(building_data)

        print(f"\n{'='*60}")
        print("SCRAPING COMPLETE!")
        print(f"{'='*60}")
        print(f"Output file: {output_file}")
        print(f"Check debug_page_source.html and debug_screenshot.png for troubleshooting")
        print(f"{'='*60}\n")

    except Exception as e:
        print(f"\nError during scraping: {e}")
        import traceback
        traceback.print_exc()
    finally:
        scraper.close()


if __name__ == "__main__":
    main()
