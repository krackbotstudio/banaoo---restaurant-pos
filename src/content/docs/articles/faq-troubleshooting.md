# FAQ & troubleshooting

## Account & login

**I cannot sign in.**  
Check email/password or use Google sign-in. Staff use **Staff login**, not the owner auth page.

**Account pending.**  
Some signups require manual approval; you will see an account pending screen until approved.

## Orders & kitchen

**Kitchen does not show new orders.**  
Confirm the correct outlet is selected. Check realtime/network. Refresh the Kitchen page.

**No sound on new orders.**  
Enable sound on Kitchen, tap the page once, and check device volume.

## Printing

**Test print works; orders do not print.**  
Update web and APK to the latest version. Confirm **auto print** and printer **enabled**. On APK, verify outlet matches the order’s outlet.

**Toast says print failed.**  
Read the message — common causes: printer disabled, no Bluetooth pairing, missing LAN IP, timeout. Open **Native printer settings** and run test print again.

**Reprint says success but no paper.**  
Fixed in recent releases: success now waits for the native printer result. Update app and redeploy web.

**Only billing printer configured in fleet.**  
Kitchen orders need a **kitchen** type printer with auto-print, or native kitchen role in the app.

**Desktop browser + Bluetooth printer.**  
Use the Android app; desktop web does not drive Bluetooth ESC/POS directly.

## Self-service

**Kitchen handoff did not print.**  
Enable **Bill with kitchen handoff** in printer settings. Print customer bill first; handoff runs after a short cutter delay.

## Mobile app

**App blank or login loop.**  
Check internet. Confirm `banaoo.in` is reachable. Clear app cache or reinstall APK.

**Bluetooth scan empty.**  
Pair printer in Android **Settings → Bluetooth** first, then scan in Banaoo native printer settings.

## Billing & GST

**GST wrong on bill.**  
Set GST % on each menu item. Discounts affect taxable amount before GST calculation.

## Still stuck?

- Email **connect@banaoo.in**
- Use the **support chat** on the website
- Include: outlet name, order number, printer type (BT/LAN/USB), and whether you use the APK or browser

## Related articles

- [Printers](/docs/printers)
- [Mobile app](/docs/mobile-app)
- [Getting started](/docs/getting-started)
