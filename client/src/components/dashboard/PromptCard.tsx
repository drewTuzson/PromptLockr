// client/src/components/prompts/PromptCard.tsx
import { useState } from "react";
import { MoreVerticalIcon, SparklesIcon } from "lucide-react";
import { EnhancementModal } from "../enhancement/EnhancementModal";

export function PromptCard({ prompt }) {
  const [showMenu, setShowMenu] = useState(false);
  const [showEnhancement, setShowEnhancement] = useState(false);

  const handleEnhanceClick = () => {
    setShowMenu(false);
    setShowEnhancement(true);
  };

  const handleEnhancedSave = async (enhancedContent: string) => {
    // Update the prompt with enhanced content
    const response = await fetch(`/api/prompts/${prompt.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({
        ...prompt,
        content: enhancedContent,
      }),
    });

    if (response.ok) {
      // Refresh the prompt list or update local state
      window.location.reload(); // Simple refresh for now
    }
    setShowEnhancement(false);
  };

  return (
    <>
      <div className="prompt-card">
        {/* Card content */}
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)}>
            <MoreVerticalIcon className="w-4 h-4" />
          </button>

          {showMenu && (
            <div className="absolute right-0 mt-2 bg-white shadow-lg rounded-lg">
              <button
                onClick={handleEnhanceClick}
                className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100"
              >
                <SparklesIcon className="w-4 h-4" />
                Enhance with AI
              </button>
              {/* Other menu options */}
            </div>
          )}
        </div>
      </div>

      {/* Pass the actual prompt content and platform */}
      {showEnhancement && (
        <EnhancementModal
          isOpen={showEnhancement}
          onClose={() => setShowEnhancement(false)}
          originalContent={prompt.content}
          platform={prompt.platform}
          promptId={prompt.id}
          onSave={handleEnhancedSave}
        />
      )}
    </>
  );
}
