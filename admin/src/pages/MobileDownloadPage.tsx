import { Link } from 'react-router-dom';

const defaultApkUrl = '/releases/app-release.apk';

export default function MobileDownloadPage() {
  const apkUrl = (import.meta.env.VITE_MOBILE_APK_URL as string | undefined)?.trim() || defaultApkUrl;

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-lg rounded-2xl border border-white/10 bg-slate-900/80 p-8 shadow-xl backdrop-blur">
        <div className="mb-6 flex items-center gap-3">
          <img src="/energydispenx-logo.png" alt="EnergyDispenX" className="h-10 w-auto rounded-lg" />
          <span className="text-sm font-medium text-slate-300">Mobile app</span>
        </div>
        <h1 className="text-2xl font-bold text-white">Download EnergyDispenX</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Install the Android app for drivers and staff. Your administrator should place the release APK on this
          server under the releases path (see deploy/nginx.conf).
        </p>
        <a
          href={apkUrl}
          download
          className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
        >
          Download APK
        </a>
        <p className="mt-4 text-xs text-slate-500">
          Default file: <code className="text-slate-400">/releases/app-release.apk</code> on this host (port 4602 or
          4604 in production).
        </p>
        <Link
          to="/login"
          className="mt-8 block text-center text-sm font-medium text-indigo-400 hover:text-indigo-300"
        >
          Back to Admin login
        </Link>
      </div>
    </div>
  );
}
