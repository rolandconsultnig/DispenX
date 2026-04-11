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
          Install the Android app to scan QR codes, track usage, and manage your card from your phone. Your
          administrator must place the release APK on this server under the releases path.
        </p>
        <a
          href={apkUrl}
          download
          className="mt-8 inline-flex w-full items-center justify-center rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
        >
          Download APK
        </a>
        <p className="mt-4 text-xs text-slate-500">
          If the download fails, ask your admin to upload <code className="text-slate-400">app-release.apk</code> to{' '}
          <code className="text-slate-400">/releases/</code> on the staff portal host (see deploy/nginx.conf).
        </p>
        <Link
          to="/login"
          className="mt-8 block text-center text-sm font-medium text-blue-400 hover:text-blue-300"
        >
          Back to Staff login
        </Link>
      </div>
    </div>
  );
}
