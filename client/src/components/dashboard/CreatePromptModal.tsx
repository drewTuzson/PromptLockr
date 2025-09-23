// client/src/components/prompts/CreatePromptForm.tsx
import { useState } from "react";
import { SparklesIcon } from "lucide-react";
import { EnhancementModal } from "../enhancement/EnhancementModal";

export function CreatePromptForm({ onClose, onSave }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [platform, setPlatform] = useState("ChatGPT");
  const [showEnhancement, setShowEnhancement] = useState(false);

  const handleEnhanceClick = () => {
    // Key fix: Only open if there's content to enhance
    if (content.trim()) {
      setShowEnhancement(true);
    }
  };

  const handleEnhancedSave = (enhancedContent: string) => {
    setContent(enhancedContent);
    setShowEnhancement(false);
  };

  return (
    <>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="Enter prompt title"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Platform</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="ChatGPT">ChatGPT</option>
            <option value="Claude">Claude</option>
            <option value="Midjourney">Midjourney</option>
            <option value="Gemini">Gemini</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            rows={8}
            placeholder="Enter your prompt content here..."
          />
          <button
            type="button"
            onClick={handleEnhanceClick}
            disabled={!content.trim()}
            className={`mt-2 px-3 py-1 rounded-lg flex items-center gap-2 text-sm ${
              content.trim()
                ? "bg-purple-600 hover:bg-purple-700 text-white"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            <SparklesIcon className="w-4 h-4" />
            Enhance with AI
          </button>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave({ title, content, platform })}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create Prompt
          </button>
        </div>
      </div>

      {/* Enhancement Modal with proper props */}
      {showEnhancement && (
        <EnhancementModal
          isOpen={showEnhancement}
          onClose={() => setShowEnhancement(false)}
          originalContent={content}
          platform={platform}
          onSave={handleEnhancedSave}
        />
      )}
    </>
  );
}
