# The Daily Find · sliBuy Auction Explorer

A static, responsive auction browser for GitHub Pages. It reads your public Google Sheet without an API key, sign-in, build step, or server.

## Put it on GitHub Pages

1. Extract the ZIP on your computer.
2. Create a GitHub repository, or open the repository you want to use.
3. Upload the extracted **contents** into the repository root. `index.html`, `app.js`, `data.js`, `styles.css`, and `config.js` must sit directly at the root, alongside the `assets` folder. Include `.nojekyll` if your upload method displays hidden files. Do not upload the ZIP itself or an extra enclosing folder.
4. Commit the files to the `main` branch.
5. Open **Settings → Pages**. Under **Build and deployment**, choose **Deploy from a branch**, then **main** and **/ (root)**. Save.
6. Wait for GitHub's Pages deployment to finish. Open the URL shown in Settings → Pages, usually `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`.

No secrets or GitHub Actions configuration are required. To update the site, replace the relevant files and commit again.

## The sheet connection

`config.js` already points to the supplied workbook:

- `Factory Sealed Report`
- `High MSRP - Appears New`
- `_scan_buffer`, which provides direct photo URLs and all scanner matches

The report tabs provide exact auction dates and **Last scan** metadata. The public scanner buffer supplies photos and additional matched auctions that spreadsheet report filters may hide. This site shows auctions collected by the scanner, not every listing on sliBuy.

The workbook must allow **Anyone with the link → Viewer**, with viewer downloading permitted. Test access in a signed-out/private browser window. The viewer's public Google Visualization feed uses no API key. If access fails, the page shows a connection message with a Retry action.

**Public sharing applies to the workbook, including hidden tabs.** Do not put session cookies, email addresses, or other private settings into a publicly shared workbook. The site does not request `Scanner Settings`, but hiding that tab does not make it private. For a private scanner setup, use a separate, sanitized public workbook containing only the auction report tabs and `_scan_buffer`, keep those copies updated, and point `config.js` at its spreadsheet ID. Do not publish the settings tab.

## Change the source or timing

Open `config.js` in a text editor. `sheetId` is the long part of a Google Sheets URL between `/d/` and `/edit`. Keep the report tab names in `sources` and the raw tab name in `rawSheet` aligned with your workbook. Set `useRawBuffer: false` to limit results to the report rows; photos may be unavailable without the raw buffer. `pollIntervalMs` controls sheet checks while the page is open; the default is five minutes. `pageSize` controls how many auction cards appear at a time.

Do not put API keys, credentials, cookies, or private links in these files: GitHub Pages serves their contents publicly.

## What refresh means

The countdown targets **7 AM America/Chicago**, automatically adjusting for Central daylight saving time. It is a schedule indicator, not a guarantee of new auction data at that exact minute.

The existing Google Apps Script must have its daily auto-scan enabled. Set the Apps Script project and spreadsheet timezones to `America/Chicago`, then use the scanner menu to enable its daily scan around 7 AM. Apps Script time-based triggers run approximately within the selected hour, and a scan can take time to finish.

This website does **not** trigger scans. It reads the sheet on opening, on manual Refresh, and every five minutes while open. The displayed **Scan started** timestamp comes from the report's **Last scan** field (B4): it records when the scanner started, not the exact time each lot's bid was captured. Bids are collected throughout that scan. Reading the sheet does not change the timestamp. When the source provides no scan time, the site says so.

Bids are scan-time snapshots, not live quotes. Auction countdowns are based on the captured end time; extensions and changes on sliBuy may not appear until the next scan. Open the official auction before bidding to check its current bid, end time, condition, retrieval details, fees, and taxes.

## Browse and make it yours

- Search titles, brands, categories, locations, and auction IDs.
- Browse categories; filter condition, snapshot bid range, savings against MSRP, and pickup location.
- View auctions ending today, include ended auctions, or switch between grid and list layouts.
- Sort by ending time, bid, savings, MSRP, or title; load more cards as needed.
- Open the original sliBuy auction in a new tab.
- Trash a card to hide it for your browser. Use **Undo**, or open **My trash** and restore individual cards or all trashed items.

Trash is saved in local browser storage for this website's address. It does not edit the spreadsheet, delete an auction, or affect other visitors. Different browsers, devices, and site addresses have separate trash. Clearing site data removes it; private browsing may discard it when the session closes. If browser storage is blocked, changes last only for that visit.

## Preview locally

Serve the folder over HTTP; do not double-click `index.html`, because browsers restrict JavaScript modules and sheet requests from `file://` pages.

If Python is installed, open a terminal in the extracted folder and run:

```sh
python -m http.server 8000
```

Then open `http://localhost:8000`. Any static web server works. No package installation is needed.

## Included files

- `index.html` — page structure
- `styles.css` — responsive design
- `app.js` — browsing, filters, refresh display, and browser trash
- `data.js` — public sheet parsing and Central-time handling
- `config.js` — source workbook and reader settings
- `assets/` — local logo and icon assets
- `.nojekyll` — serves the files directly on GitHub Pages

The logo follows the supplied sliBuy reference. This is an independent auction explorer; bids and transactions take place on sliBuy.
