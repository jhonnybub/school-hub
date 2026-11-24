# מרכז המידע של ט׳3 — אפליקציית טלפון

אפליקציית ווב למובייל (PWA) שאפשר לפתוח בדפדפן ולשמור במסך הבית של האייפון, בלי שה-Mac יהיה דלוק. עברית מימין לשמאל, עיצוב בסגנון אפל לפי הסקיצה של Ringo.

מוצגים **נתונים אמיתיים** מכיתה ט׳3 (שמות מורים בפרטי בלבד, בלי שמות תלמידים). הקבצים החיים הם `data/schedule.json`, `data/exams.json` ו-`data/newsletter.json`. האפליקציה טוענת אותם קודם, ואם אין — חוזרת לבלוק `EMBEDDED_DATA` ב-`index.html` (מסומן ב-`// TODO: Daft data plugs in here`) עם אותם נתונים. אין משיכה של נתונים מאתרים חיצוניים.

במערכת מוצגות שעות לפי לוח הצלצולים המובנה באפליקציה (שיעור 1 בשעה 08:30, וכן הלאה). אם בקבצי הנתונים אין שעות, הן מתמלאות לפי מספר השיעור. אחרי ששיעור של היום נגמר מופיע לידו וי קטן. אם אין מערכת למחר, במסך הבית מוצגת מערכת היום עם התאריך האמיתי והודעה שהמערכת למחר עוד לא עודכנה. העלון השבועי יופיע כשיהיה קובץ מוכן.

## שמירה במסך הבית (אייפון)

1. מעלים את התיקייה לאתר (ראו למטה) ופותחים את הקישור ב-**Safari**.
2. לוחצים על שיתוף (הריבוע עם החץ) ← **הוספה למסך הבית**.
3. האפליקציה נפתחת במסך מלא, בלי שורת כתובת.

## איך מעלים בחינם

צריך כתובת https ציבורית (אייפון דורש את זה כדי לשמור במסך הבית בצורה אמינה). אפשרויות פשוטות בלי שרת משלכם:

- **Netlify Drop** — נכנסים ל-[https://app.netlify.com/drop](https://app.netlify.com/drop) וגוררים את תיקיית `school_hub_web`. מקבלים קישור מיד, בלי חשבון מורכב.
- **Cloudflare Pages** — מעלים את התיקייה או מחברים למאגר Git, חינם.
- **GitHub Pages** — יוצרים מאגר ציבורי, מעלים את הקבצים, ומפעילים Pages (Settings ← Pages) על הענף הראשי. הכתובת תהיה בסגנון `https://USERNAME.github.io/REPO/`.

אחרי שמעלים, שולחים לג'וני את הקישור. אין צורך ב-Streamlit או ב-Mac פתוח.

קבצים עיקריים: `index.html`, `manifest.json`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `data/`.

## Day over + push notifications
- After today's last non-cancelled lesson ends (Asia/Jerusalem), today's list turns gray and shows «נגמר!» (home + schedule). Re-checked every minute.
- `sw.js`: push + notificationclick only, no fetch handler (data always from network). Data is fetched with `cache: "no-cache"`.
- «הפעל התראות» at the bottom of home subscribes with the VAPID public key and shows the subscription JSON to copy to Paul.
- Sender lives on the box: /workspace/school_hub_push/send_lesson_push.py (private key is NOT in this repo).
