# TS: four apps in one APK

**Today** (daily scorecard across everything), **Goals** (MBA study planner, timer, stats), **Trading** (routine tracker), **Berserker** (training). Everything works offline and keeps its data on your phone.

## Build the APK (about 10 minutes, once)
1. Create a **private** repository on github.com. Keep it private: `debug.keystore` is inside.
2. Upload everything from this folder, including the hidden `.github` folder. Commit to `main`.
3. Open the **Actions** tab. The **Build APK** workflow runs by itself; wait for the green check.
4. Open the **Releases** page of the repository and download `TS.apk` on your phone, then install it (allow "install unknown apps" for your browser when asked).

Every later push builds a new APK. Install it over the old one: your data stays, because every build is signed with the same key and has a higher version number.

## First launch checklist
- Allow notifications when asked. In **Today > Backup and tools** tap **Test notification** to confirm it works.
- On Xiaomi, Oppo, Vivo or Samsung phones, set TS to "No restrictions" under battery settings, or reminders may arrive late.
- Open **Goals > Planner**, enter your shift hours, then pick Morning, Afternoon or Off for each day. Tap any study block to see the exact lesson, what to learn, what to practise, how to split the minutes, and when you are done. **Syllabus** lists all lessons; edit `www/apps/goals/curriculum.js` to change them.

## Backups (important)
Data lives only in the app. Uninstalling or clearing app storage deletes it. Use **Today > Export backup** and save the file to Drive or email it to yourself. **Restore** loads such a file. Today reminds you when your last backup is a week old.

## Notes
- Android back button: returns to Today first, and only exits from Today.
- Berserker dates now use your phone's local day (previously UTC, which shifted workouts before 08:00 in UTC+8).
- Study counts as done on Today at 60 minutes by default; change it in Today > Settings.
- Rename the app in `capacitor.config.json` (`appName`). Do not change `appId` after installing, or Android treats it as a different app.
- This is a debug-signed build for personal use, not a Play Store release.
