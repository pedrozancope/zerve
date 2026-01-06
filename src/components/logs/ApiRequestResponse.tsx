import { useState } from "react"
import { ChevronDown, ChevronUp, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ApiRequestResponseProps {
  request?: Record<string, unknown>
  response?: Record<string, unknown>
  title?: string
  className?: string
  defaultExpanded?: boolean
}

export function ApiRequestResponse({
  request,
  response,
  title = "Chamada de API Externa",
  className,
  defaultExpanded = false,
}: ApiRequestResponseProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  if (!request && !response) return null

  const hasRequest = request && Object.keys(request).length > 0
  const hasResponse = response && Object.keys(response).length > 0

  return (
    <div className={`mt-3 ${className || ""}`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setExpanded(!expanded)}
        className="w-full justify-between h-auto py-2.5 px-3 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950/40 dark:via-indigo-950/40 dark:to-purple-950/40 hover:from-blue-100 hover:via-indigo-100 hover:to-purple-100 dark:hover:from-blue-900/40 dark:hover:via-indigo-900/40 dark:hover:to-purple-900/40 border border-blue-200 dark:border-blue-800 transition-all shadow-sm"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-blue-900 dark:text-blue-100 flex items-center gap-2">
            🌐 {title}
          </span>
          {hasRequest && hasResponse && (
            <span className="text-xs bg-white/60 dark:bg-slate-900/60 px-2 py-0.5 rounded-full text-slate-600 dark:text-slate-400 font-medium">
              Request + Response
            </span>
          )}
          {hasRequest && !hasResponse && (
            <span className="text-xs bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded-full text-blue-700 dark:text-blue-300 font-medium">
              Request
            </span>
          )}
          {!hasRequest && hasResponse && (
            <span className="text-xs bg-green-100 dark:bg-green-900/60 px-2 py-0.5 rounded-full text-green-700 dark:text-green-300 font-medium">
              Response
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-blue-700 dark:text-blue-300" />
        ) : (
          <ChevronDown className="h-4 w-4 text-blue-700 dark:text-blue-300" />
        )}
      </Button>

      {expanded && (
        <div className="mt-2 p-4 rounded-lg bg-gradient-to-br from-slate-50/80 to-slate-100/80 dark:from-slate-900/50 dark:to-slate-800/50 border border-slate-200 dark:border-slate-700 shadow-inner">
          <div
            className={
              hasRequest && hasResponse ? "grid md:grid-cols-2 gap-4" : ""
            }
          >
            {hasRequest && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/10 dark:bg-blue-500/20">
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                      📤
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Request Payload
                  </h4>
                </div>
                <div className="relative">
                  <pre className="text-xs bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-300 dark:border-slate-600 overflow-auto max-h-80 font-mono leading-relaxed shadow-sm">
                    {JSON.stringify(request, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {hasRequest && hasResponse && (
              <div className="flex items-center justify-center md:col-span-2 my-2">
                <ArrowRight className="h-5 w-5 text-slate-400 dark:text-slate-600" />
              </div>
            )}

            {hasResponse && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500/10 dark:bg-green-500/20">
                    <span className="text-xs font-bold text-green-600 dark:text-green-400">
                      📥
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Response Body
                  </h4>
                </div>
                <div className="relative">
                  <pre className="text-xs bg-white dark:bg-slate-950 p-3 rounded-lg border border-slate-300 dark:border-slate-600 overflow-auto max-h-80 font-mono leading-relaxed shadow-sm">
                    {JSON.stringify(response, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
