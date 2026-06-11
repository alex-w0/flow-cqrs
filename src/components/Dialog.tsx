import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangle, Info, PenLine } from 'lucide-react';

export interface AlertOptions {
  title: string;
  message: string;
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  /** Renders the confirm button in red for destructive actions. */
  danger?: boolean;
}

export interface PromptOptions {
  title: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
}

type DialogRequest =
  | { kind: 'alert'; options: AlertOptions; resolve: () => void }
  | { kind: 'confirm'; options: ConfirmOptions; resolve: (confirmed: boolean) => void }
  | { kind: 'prompt'; options: PromptOptions; resolve: (value: string | null) => void };

interface DialogApi {
  /** Resolves when the user dismisses the dialog. */
  alert: (options: AlertOptions) => Promise<void>;
  /** Resolves true on confirm, false on cancel/escape/backdrop. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Resolves the entered string on confirm, null on cancel/escape/backdrop. */
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const DialogContext = createContext<DialogApi | null>(null);

export function useDialog(): DialogApi {
  const api = useContext(DialogContext);
  if (!api) throw new Error('useDialog must be used inside <DialogProvider>');
  return api;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<DialogRequest | null>(null);

  const api = useMemo<DialogApi>(
    () => ({
      alert: (options) => new Promise((resolve) => setRequest({ kind: 'alert', options, resolve })),
      confirm: (options) => new Promise((resolve) => setRequest({ kind: 'confirm', options, resolve })),
      prompt: (options) => new Promise((resolve) => setRequest({ kind: 'prompt', options, resolve })),
    }),
    [],
  );

  return (
    <DialogContext.Provider value={api}>
      {children}
      {request && <DialogModal request={request} close={() => setRequest(null)} />}
    </DialogContext.Provider>
  );
}

function DialogModal({ request, close }: { request: DialogRequest; close: () => void }) {
  const [value, setValue] = useState(request.kind === 'prompt' ? (request.options.defaultValue ?? '') : '');

  const dismiss = () => {
    if (request.kind === 'alert') request.resolve();
    else if (request.kind === 'confirm') request.resolve(false);
    else request.resolve(null);
    close();
  };

  const confirm = () => {
    if (request.kind === 'alert') request.resolve();
    else if (request.kind === 'confirm') request.resolve(true);
    else request.resolve(value);
    close();
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        dismiss();
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  const danger = request.kind === 'confirm' && request.options.danger === true;
  const confirmLabel =
    request.kind === 'alert' ? 'OK' : (request.options.confirmLabel ?? (request.kind === 'prompt' ? 'Save' : 'Confirm'));

  const Icon = danger ? AlertTriangle : request.kind === 'prompt' ? PenLine : Info;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="dialog-backdrop absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={dismiss} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="dialog-panel relative w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-2xl shadow-black/60"
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              danger ? 'bg-red-500/15 text-red-400' : 'bg-indigo-500/15 text-indigo-400'
            }`}
          >
            <Icon size={18} />
          </span>
          <div className="min-w-0">
            <h2 id="dialog-title" className="text-sm font-semibold text-slate-100">
              {request.options.title}
            </h2>
            {'message' in request.options && request.options.message && (
              <p className="mt-1 text-sm leading-snug text-slate-400">{request.options.message}</p>
            )}
          </div>
        </div>

        {request.kind === 'prompt' && (
          <input
            autoFocus
            value={value}
            placeholder={request.options.placeholder}
            className="mt-4 w-full rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-indigo-400"
            onChange={(event) => setValue(event.target.value)}
            onFocus={(event) => event.target.select()}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Enter') confirm();
            }}
          />
        )}

        <div className="mt-5 flex justify-end gap-2">
          {request.kind !== 'alert' && (
            <button
              type="button"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              onClick={dismiss}
            >
              Cancel
            </button>
          )}
          <button
            type="button"
            autoFocus={request.kind !== 'prompt'}
            className={`rounded-md px-3 py-1.5 text-sm font-medium text-white transition-colors ${
              danger ? 'bg-red-500 hover:bg-red-400' : 'bg-indigo-500 hover:bg-indigo-400'
            }`}
            onClick={confirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
