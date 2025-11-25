               ********* MediFind-Webapp ************

MediFind is a small single-page app that helps you look up medicines and see clear information like warnings, dosage, indications, approval history, and any recalls. It runs fully on the client side with plain HTML, CSS and JavaScript. The app uses the public OpenFDA APIs as the data source.

This README explains what the app does, which APIs are used, how the caching works, how to run it locally, and how I deployed it on the ALU web servers with the load balancer.

*** VIDEO DEMO link: https://youtu.be/G_LwXvSCAFo
*** REPO link: https://github.com/shyakafrancis123/medifind-webapp

***What the app can do
-Live search with a short delay so the API isn’t spammed.
-Combined results from three OpenFDA endpoints.
-Shows warnings, dosage, indications, product approvals and recall notices in one place.
-Local caching to reduce repeat requests.
-Favorites saved in localStorage (you can export and import them).
-Simple error handling with friendly messages.
-Responsive layout with the main sections: Search, Favorites, About, 

***Settings.
The goal was to make something actually useful, hence the customable features to be used for each user prefences.

***The APIs used (OpenFDA)
These are the exact endpoints the app hits. They are all public, no API key needed.

1. Drug Label
-Human-friendly data like warnings, dosage, indications.
https://api.fda.gov/drug/label.json?search={query}&limit=10

Example query used internally:
openfda.brand_name:"aspirin" OR openfda.generic_name:"aspirin"

2. DrugsFDA
-Approval history, sponsor details, product metadata.
https://api.fda.gov/drug/drugsfda.json?search={query}&limit=5

3. Enforcement (Recalls)
-Recall notices and enforcement actions.
https://api.fda.gov/drug/enforcement.json?search={query}&limit=10

***********API behavior notes************
-Some endpoints return 404 if nothing is found. That is why I treat each one independently.

-The app only shows “no results found” if all three endpoints have no data.

-Rate limits exist. If OpenFDA returns 429, the app shows a clear message.

-The app retries small network failures (5xx or timeout) with basic backoff.

-I Credit the OpenFDA team for making these APIs publicly available.

Caching and Storage

******* API cache
-Stored in localStorage under medifind_api_cache_v1.
- The Default TTL: 10 minutes. Falls back to sessionStorage if needed.

-Favorites
Stored under medifind_favorites_v1. You can export/import as JSON.

-Settings
Stored under medifind_settings_v2.

-If the browser blocks storage (quota or private mode), the app shows a useful error through the centralized error handler.

**********How to run the app locally
This is a fully static site. Any local server works.
Quick example using Python:
python3 -m http.server 8080

Then open:
http://localhost:8080

Try searching for things like “aspirin”, “ibuprofen”, or something obscure to see how the recall-only cases look.

**************Deployment (Web01, Web02, Load Balancer)
I deployed the app on both ALU web servers and then configured the load balancer so all traffic is distributed evenly.

Steps I followed
1. Clone the repo on both servers
cd /var/www
sudo git clone https://github.com/shyakafrancis123/medifind-webapp

2. Set permissions
sudo chown -R ubuntu:ubuntu /var/www/medifind-webapp

3. Point Nginx to the project folder

In /etc/nginx/sites-available/default on both servers:

root /var/www/medifind-webapp;
index index.html;


Then reload:
sudo systemctl reload nginx

4. Configure the load balancer (lb01)
I updated the Nginx config to pass incoming traffic to both servers:

upstream medifind_upstream {
    server 6920-web-01;
    server 6920-web-02;
}

server {
    listen 80;
    location / {
        proxy_pass http://medifind_upstream;
    }
}


Then reload:
sudo systemctl reload nginx

***************** Testing the deployment
I accessed the app through the load balancer IP and confirmed that page loads were switching between Web01 and Web02.

Both servers returned the same files since they share the same repo.

API requests worked normally since everything is client-side.

********* Things to test
Search for “aspirin” and check label + approvals.

Search for something that only has recalls and see how recall data is shown.

Add items to favorites, refresh the page, confirm persistence.

Try fast repeated searches to see caching kick in and reduce delay.

************ Error handling
The app shows clear messages for:
-No results found.
-Rate limit hits.
-Network failures.
-Unexpected OpenFDA responses.

***********LocalStorage issues.
The centralized logic is inside js/api.js, js/logger.js, and js/error-handler.js.

***************Notes and disclaimer
This app is not for medical decisions. It’s just a quick lookup helper.

Repository link
https://github.com/shyakafrancis123/medifind-webapp