# MyOS

محاكاة عربية تفاعلية لسطح مكتب مستوحى من Windows 11، باستخدام JavaScript وCSS وVite.

## التشغيل

المتطلبات: Node.js 20.19+ أو 22.12+، وnpm.

```sh
npm ci --cache /workspace/.npm-cache
npm run dev -- --port 5173
```

## البناء والاختبار

```sh
npm run build
npm test
```

تستخدم اختبارات Playwright متصفح Chromium المثبت في `/usr/bin/chromium`. يمكن تحديد مسار آخر باستخدام `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.

## المزايا

- سطح مكتب عربي يدعم الشاشات الصغيرة، وقائمة ابدأ مع البحث وشريط مهام وساعة.
- نوافذ قابلة للسحب والتكبير والتصغير والإغلاق، والنقر المزدوج على عنوان النافذة لتكبيرها.
- مفكرة تحفظ النص على المتصفح، وحاسبة، ومستكشف ملفات توضيحي.
- مظهر نهاري وليلي وخلفيات، مع حفظ التفضيلات محليًا.
- شاشة قفل توضيحية وإعدادات سريعة تجريبية.

هذا المشروع محاكاة واجهة، وليس نظام تشغيل. الملفات المعروضة عينات، والقفل ليس حماية أمنية، وأزرار الشبكة وعدم الإزعاج لا تغيّر إعدادات الجهاز. الملاحظات محفوظة في localStorage لهذا المتصفح فقط. لا يتبع المشروع Microsoft ولا يستخدم أصول Windows.

## النشر العام على Cloudflare Pages

البناء ثابت ولا يحتاج خادمًا خلفيًا. اختُبر `npm run build`، ولم يُنفّذ النشر بعد لعدم توفر بيانات Cloudflare.

1. أضف `CLOUDFLARE_API_TOKEN` بشكل آمن في إعدادات البيئة، بصلاحية Account / Cloudflare Pages / Edit للحساب المستهدف. أضف معرّف الحساب غير السري باسم `CLOUDFLARE_ACCOUNT_ID`. لا تضع الرمز في ملفات المشروع.
2. نفّذ من جذر المشروع بعد تفعيل الإعدادات:

```sh
npm run build
npx --yes --cache /workspace/.npm-cache wrangler@4.151.1 pages project create myos-desktop --production-branch main
npx --yes --cache /workspace/.npm-cache wrangler@4.151.1 pages deploy dist --project-name myos-desktop --branch main
```

أمر الإنشاء مطلوب مرة واحدة فقط؛ إذا كان المشروع موجودًا في حسابك فتجاوزه. استخدم اسمًا آخر إذا كان الاسم محجوزًا. استخدم رابط النشر الفعلي الذي تُرجعه Cloudflare بعد نجاح الرفع. لا تنشر مجلد المشروع كاملًا؛ انشر `dist` فقط.

بديل دون رمز API: من لوحة Cloudflare اختر Workers & Pages ثم Create application ثم Pages ثم Upload assets، وارفع محتويات `dist` أو نسخة ZIP المبنية، ثم Deploy site.

## النشر على GitHub Pages

يحتوي المشروع مسار GitHub Actions في `.github/workflows/pages.yml` يبني الموقع وينشر `dist` عند كل رفع إلى `main`. من إعدادات مستودع GitHub افتح **Pages → Build and deployment → Source** واختر **GitHub Actions**. بعد نجاح عملية النشر، يظهر رابط الموقع في **Actions** وفي إعدادات Pages. يستخدم Vite مسارات أصول نسبية ليدعم مسار المستودع `/MyOS/`.
