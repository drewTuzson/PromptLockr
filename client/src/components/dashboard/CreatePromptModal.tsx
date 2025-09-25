import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, Sparkles } from 'lucide-react';
import { useCreatePrompt, useUpdatePrompt, usePrompts } from '@/hooks/usePrompts';
import { useFolders, useCreateFolder } from '@/hooks/useFolders';
import { Prompt } from '@shared/schema';
import { EnhancementModal } from '@/components/enhancement/EnhancementModal';

import { createPromptSchema } from '@shared/schema';

const promptSchema = createPromptSchema.extend({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  content: z.string().min(1, 'Content is required').max(100000, 'Content too long'),
});

type PromptFormData = z.infer<typeof promptSchema>;

interface CreatePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingPrompt?: Prompt;
}

export function CreatePromptModal({ isOpen, onClose, editingPrompt }: CreatePromptModalProps) {
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(editingPrompt?.tags || []);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [customPlatform, setCustomPlatform] = useState<string>('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showEnhancement, setShowEnhancement] = useState(false);
  
  const createPrompt = useCreatePrompt();
  const updatePrompt = useUpdatePrompt();
  const createFolder = useCreateFolder();
  const { data: folders = [] } = useFolders();
  const { data: allPrompts = [] } = usePrompts();
  
  const form = useForm<PromptFormData>({
    resolver: zodResolver(promptSchema),
    defaultValues: {
      title: editingPrompt?.title || '',
      content: editingPrompt?.content || '',
      platform: editingPrompt?.platform || 'ChatGPT',
      tags: editingPrompt?.tags || [],
      isFavorite: editingPrompt?.isFavorite || false,
    },
  });

  // Reset form when editingPrompt changes
  React.useEffect(() => {
    if (editingPrompt) {
      console.log('Resetting form with editingPrompt:', editingPrompt);
      
      // Check if this is a custom platform (not in our predefined list)
      const predefinedPlatforms = ['ChatGPT', 'Claude', 'Perplexity', 'Gemini', 'Mistral', 'Midjourney', 'DALL-E', 'Stable Diffusion', 'Leonardo AI', 'Llama', 'Cohere'];
      const isCustomPlatform = !predefinedPlatforms.includes(editingPrompt.platform);
      
      form.reset({
        title: editingPrompt.title || '',
        content: editingPrompt.content || '',
        platform: isCustomPlatform ? 'Custom/Other' : editingPrompt.platform,
        tags: editingPrompt.tags || [],
        isFavorite: editingPrompt.isFavorite || false,
      });
      setTags(editingPrompt.tags || []);
      setCustomPlatform(isCustomPlatform ? editingPrompt.platform : '');
    } else {
      form.reset({
        title: '',
        content: '',
        platform: 'ChatGPT',
        tags: [],
        isFavorite: false,
      });
      setTags([]);
      setCustomPlatform('');
      setIsCreatingFolder(false);
      setNewFolderName('');
    }
  }, [editingPrompt, form]);

  const onSubmit = async (data: PromptFormData) => {
    try {
      // Validate custom platform name is provided when Custom/Other is selected
      if (data.platform === 'Custom/Other' && !customPlatform.trim()) {
        form.setError('platform', { 
          message: 'Custom platform name is required when Custom/Other is selected' 
        });
        return;
      }
      
      // Use custom platform name if Custom/Other is selected and custom name is provided
      const finalPlatform = data.platform === 'Custom/Other' && customPlatform.trim() 
        ? customPlatform.trim() 
        : data.platform;
      
      const promptData = {
        ...data,
        platform: finalPlatform,
        tags,
      };

      if (editingPrompt) {
        await updatePrompt.mutateAsync({
          id: editingPrompt.id,
          ...promptData,
          platform: promptData.platform as 'ChatGPT' | 'Claude' | 'Perplexity' | 'Gemini' | 'Mistral' | 'Midjourney' | 'DALL-E' | 'Stable Diffusion' | 'Leonardo AI' | 'Llama' | 'Cohere' | 'Custom/Other',
        });
      } else {
        await createPrompt.mutateAsync(promptData);
      }
      
      handleClose();
    } catch (error) {
      // Error is handled by the mutation hooks
    }
  };

  const handleClose = () => {
    form.reset();
    setTags([]);
    setTagInput('');
    setCustomPlatform('');
    setShowSuggestions(false);
    onClose();
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      return;
    }

    try {
      const newFolder = await createFolder.mutateAsync({
        name: newFolderName.trim(),
      });
      
      // Select the newly created folder
      form.setValue('folderId', newFolder.id);
      
      // Reset folder creation state
      setIsCreatingFolder(false);
      setNewFolderName('');
    } catch (error) {
      console.error('Failed to create folder:', error);
    }
  };

  const handleFolderSelectChange = (value: string) => {
    if (value === 'create-new') {
      setIsCreatingFolder(true);
      setNewFolderName('');
      form.setValue('folderId', null);
    } else {
      setIsCreatingFolder(false);
      setNewFolderName('');
      form.setValue('folderId', value === 'none' ? null : value);
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleTagKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
      setShowSuggestions(false);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // Get all unique tags from all prompts
  const getAllUniqueTags = () => {
    const allTags = allPrompts.flatMap(prompt => prompt.tags || []);
    return Array.from(new Set(allTags)).filter(tag => tag && tag.length > 0);
  };

  // Filter suggestions based on current input
  const getSuggestions = () => {
    if (!tagInput.trim()) return [];
    const allUniqueTags = getAllUniqueTags();
    return allUniqueTags
      .filter(tag => 
        tag.toLowerCase().includes(tagInput.toLowerCase()) && 
        !tags.includes(tag) // Don't suggest already added tags
      )
      .slice(0, 5); // Limit to 5 suggestions
  };

  const suggestions = getSuggestions();

  const handleTagInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setTagInput(value);
    setShowSuggestions(value.length > 0);
  };

  const selectSuggestion = (suggestion: string) => {
    setTags([...tags, suggestion]);
    setTagInput('');
    setShowSuggestions(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editingPrompt ? 'Edit Prompt' : 'Create New Prompt'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      data-testid="input-prompt-title"
                      placeholder="Enter a descriptive title for your prompt"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="platform"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Platform</FormLabel>
                  <FormControl>
                    <Select
                      data-testid="select-platform"
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        if (value !== 'Custom/Other') {
                          setCustomPlatform('');
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a platform" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ChatGPT">ChatGPT</SelectItem>
                        <SelectItem value="Claude">Claude</SelectItem>
                        <SelectItem value="Perplexity">Perplexity</SelectItem>
                        <SelectItem value="Gemini">Gemini</SelectItem>
                        <SelectItem value="Mistral">Mistral</SelectItem>
                        <SelectItem value="Midjourney">Midjourney</SelectItem>
                        <SelectItem value="DALL-E">DALL-E</SelectItem>
                        <SelectItem value="Stable Diffusion">Stable Diffusion</SelectItem>
                        <SelectItem value="Leonardo AI">Leonardo AI</SelectItem>
                        <SelectItem value="Llama">Llama</SelectItem>
                        <SelectItem value="Cohere">Cohere</SelectItem>
                        <SelectItem value="Custom/Other">Custom/Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Custom Platform Input - conditionally shown */}
            {form.watch('platform') === 'Custom/Other' && (
              <FormItem>
                <FormLabel>Enter custom platform name</FormLabel>
                <FormControl>
                  <Input
                    data-testid="input-custom-platform"
                    placeholder="e.g., GPT-4, Bard, Custom AI"
                    value={customPlatform}
                    onChange={(e) => setCustomPlatform(e.target.value)}
                  />
                </FormControl>
                {form.watch('platform') === 'Custom/Other' && !customPlatform.trim() && (
                  <FormMessage>Custom platform name is required</FormMessage>
                )}
              </FormItem>
            )}

            <FormField
              control={form.control}
              name="folderId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Folder (Optional)</FormLabel>
                  <FormControl>
                    <Select
                      data-testid="select-folder"
                      value={isCreatingFolder ? "create-new" : (field.value || "none")}
                      onValueChange={handleFolderSelectChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a folder" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No Folder</SelectItem>
                        {folders.map((folder) => (
                          <SelectItem key={folder.id} value={folder.id}>
                            {folder.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="create-new">+ Create New Folder</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Create New Folder Input - conditionally shown */}
            {isCreatingFolder && (
              <FormItem>
                <FormLabel>Enter folder name</FormLabel>
                <FormControl>
                  <div className="flex gap-2">
                    <Input
                      data-testid="input-new-folder-name"
                      placeholder="e.g., Work Prompts, AI Agents, etc."
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCreateFolder();
                        }
                        if (e.key === 'Escape') {
                          setIsCreatingFolder(false);
                          setNewFolderName('');
                        }
                      }}
                      autoFocus
                    />
                    <Button
                      type="button"
                      data-testid="button-create-folder"
                      onClick={handleCreateFolder}
                      disabled={!newFolderName.trim() || createFolder.isPending}
                      size="sm"
                    >
                      {createFolder.isPending ? 'Creating...' : 'Create'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      data-testid="button-cancel-folder"
                      onClick={() => {
                        setIsCreatingFolder(false);
                        setNewFolderName('');
                      }}
                      size="sm"
                    >
                      Cancel
                    </Button>
                  </div>
                </FormControl>
                {!newFolderName.trim() && (
                  <FormMessage>Folder name is required</FormMessage>
                )}
              </FormItem>
            )}

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content</FormLabel>
                  <FormControl>
                    <Textarea
                      data-testid="textarea-prompt-content"
                      placeholder="Enter your prompt content here..."
                      className="min-h-[200px]"
                      {...field}
                    />
                  </FormControl>
                  <div className="flex items-center justify-between">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      data-testid="button-enhance"
                      onClick={() => setShowEnhancement(true)}
                      disabled={!field.value.trim()}
                      className="flex items-center gap-2"
                    >
                      <Sparkles className="w-4 h-4" />
                      Enhance with AI
                    </Button>
                    <div className="text-xs text-muted-foreground">
                      {field.value.length} characters
                    </div>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <FormLabel>Tags</FormLabel>
              <div className="flex flex-wrap gap-2 mb-2">
                {tags.map((tag, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="flex items-center gap-1"
                    data-testid={`tag-${tag}-${index}`}
                  >
                    {tag}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => removeTag(tag)}
                      data-testid={`button-remove-tag-${index}`}
                    />
                  </Badge>
                ))}
              </div>
              <div className="relative">
                <div className="flex gap-2">
                  <Input
                    data-testid="input-tag"
                    placeholder="Add a tag"
                    value={tagInput}
                    onChange={handleTagInputChange}
                    onKeyDown={handleTagKeyPress}
                    onFocus={() => setShowSuggestions(tagInput.length > 0)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)} // Delay to allow clicking suggestions
                  />
                  <Button
                    data-testid="button-add-tag"
                    type="button"
                    variant="outline"
                    onClick={addTag}
                    disabled={!tagInput.trim()}
                  >
                    Add
                  </Button>
                </div>
                
                {/* Autocomplete Suggestions Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-background border border-border rounded-md shadow-lg">
                    {suggestions.map((suggestion, index) => (
                      <div
                        key={suggestion}
                        data-testid={`suggestion-${suggestion}`}
                        className="px-3 py-2 cursor-pointer hover:bg-[var(--btn-hover-bg)] hover:text-[var(--btn-hover-text)] transition-colors text-sm border-b border-border last:border-b-0"
                        onClick={() => selectSuggestion(suggestion)}
                      >
                        {suggestion}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <Button
                data-testid="button-cancel"
                type="button"
                variant="outline"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Button
                data-testid="button-save-prompt"
                type="submit"
                disabled={createPrompt.isPending || updatePrompt.isPending}
              >
                {editingPrompt ? 'Update Prompt' : 'Create Prompt'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>

      {showEnhancement && (
        <EnhancementModal
          isOpen={showEnhancement}
          onClose={() => setShowEnhancement(false)}
          promptId={editingPrompt?.id}
          initialContent={form.watch('content') || ''}
          platform={form.watch('platform') || 'ChatGPT'}
          mode={editingPrompt ? 'existing' : 'new'}
          onEnhanced={(enhanced: string) => {
            form.setValue('content', enhanced);
            setShowEnhancement(false);
          }}
        />
      )}
    </Dialog>
  );
}
