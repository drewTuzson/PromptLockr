// client/src/components/enhancement/EnhancementModal.tsx
import * as React from "react";
import { SparklesIcon, RefreshCwIcon, XIcon } from "lucide-react";

interface EnhancementModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalContent: string;
  platform?: string;
  promptId?: string;
  onSave?: (enhanced: string) => void;
}

export function EnhancementModal({
  isOpen,
  onClose,
  originalContent = "",
  platform = "ChatGPT",
  promptId,
  onSave,
}: EnhancementModalProps) {
  const [tone, setTone] = React.useState("Creative");
  const [focus, setFocus] = React.useState("Clarity");
  const [isEnhancing, setIsEnhancing] = React.useState(false);
  const [enhanced, setEnhanced] = React.useState("");
  const [error, setError] = React.useState("");
  const [rateLimit, setRateLimit] = React.useState({
    remaining: 10,
    limit: 10,
  });

  // Fetch rate limit on mount
  React.useEffect(() => {
    fetchRateLimit();
  }, []);

  const fetchRateLimit = async () => {
    try {
      const response = await fetch("/api/enhancement/rate-limit", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setRateLimit({
          remaining: data.remaining || 10,
          limit: data.limit || 10,
        });
      }
    } catch (err) {
      console.error("Failed to fetch rate limit:", err);
    }
  };

  const handleEnhance = async () => {
    if (!originalContent || originalContent.trim().length === 0) {
      setError("Please enter content to enhance");
      return;
    }

    setIsEnhancing(true);
    setError("");

    try {
      const endpoint = promptId
        ? `/api/prompts/${promptId}/enhance`
        : "/api/prompts/enhance-new";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          content: originalContent,
          platform: platform,
          tone: tone.toLowerCase(),
          focus: focus.toLowerCase(),
        }),
      });

      const data = await response.json();

      if (response.ok && data.enhanced) {
        setEnhanced(data.enhanced);
        setRateLimit((prev) => ({
          ...prev,
          remaining: Math.max(0, prev.remaining - 1),
        }));
      } else {
        setError(data.error || "Failed to enhance prompt");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleUseEnhanced = () => {
    if (onSave && enhanced) {
      onSave(enhanced);
      onClose();
    }
  };

  // The key fix: enable button when content exists and user has rate limit
  const canEnhance =
    originalContent &&
    originalContent.trim().length > 0 &&
    rateLimit.remaining > 0 &&
    !isEnhancing;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-5xl w-full max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <SparklesIcon className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-semibold">AI Prompt Enhancement</h2>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Rate Limit: {rateLimit.remaining}/{rateLimit.limit} remaining
            </span>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Options */}
        <div className="flex gap-6 p-4 bg-gray-50 dark:bg-gray-800/50">
          <div>
            <label className="text-sm font-medium mb-1 block">
              Target Platform
            </label>
            <select
              value={platform}
              disabled
              className="px-3 py-1 text-sm border rounded-lg bg-gray-100"
            >
              <option value="ChatGPT">ChatGPT</option>
              <option value="Claude">Claude</option>
              <option value="Midjourney">Midjourney</option>
              <option value="Gemini">Gemini</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Tone</label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="px-3 py-1 text-sm border rounded-lg"
            >
              <option value="Creative">Creative</option>
              <option value="Professional">Professional</option>
              <option value="Casual">Casual</option>
              <option value="Academic">Academic</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Focus</label>
            <select
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              className="px-3 py-1 text-sm border rounded-lg"
            >
              <option value="Clarity">Clarity</option>
              <option value="Engagement">Engagement</option>
              <option value="Specificity">Specificity</option>
              <option value="Structure">Structure</option>
            </select>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg">
            {error}
          </div>
        )}

        {/* Content Comparison */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium mb-3 flex justify-between">
                Original
                <span className="text-sm text-gray-500">
                  {originalContent.length} chars
                </span>
              </h3>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg min-h-[200px] whitespace-pre-wrap">
                {originalContent || "No content provided"}
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-3">Enhanced</h3>
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg min-h-[200px]">
                {isEnhancing ? (
                  <div className="flex items-center justify-center h-full">
                    <RefreshCwIcon className="w-6 h-6 animate-spin text-purple-600 mr-2" />
                    <span>Enhancing your prompt...</span>
                  </div>
                ) : enhanced ? (
                  <div className="whitespace-pre-wrap">{enhanced}</div>
                ) : (
                  <div className="text-gray-500 text-center">
                    Click "Enhance" to see AI improvements
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t">
          <button
            onClick={handleEnhance}
            disabled={!canEnhance}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
              canEnhance
                ? "bg-purple-600 hover:bg-purple-700 text-white"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            <SparklesIcon className="w-4 h-4" />
            {enhanced ? "Re-enhance" : "Enhance"}
          </button>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            {enhanced && (
              <button
                onClick={handleUseEnhanced}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Use Enhanced
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
