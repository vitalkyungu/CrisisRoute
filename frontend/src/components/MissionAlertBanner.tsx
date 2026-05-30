import { Bell, X } from "lucide-react";

interface MissionAlertBannerProps {
  title: string;
  message: string;
  onDismiss: () => void;
}

export default function MissionAlertBanner({ title, message, onDismiss }: MissionAlertBannerProps) {
  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-lg">
      <div className="bg-red-950 border border-red-600 rounded-xl p-4 shadow-2xl shadow-red-900/40">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-red-600/30 rounded-full flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-red-300 text-sm">{title}</h3>
            <p className="text-slate-300 text-sm mt-1 line-clamp-3">{message}</p>
          </div>
          <button
            onClick={onDismiss}
            className="text-slate-400 hover:text-slate-200 shrink-0"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
