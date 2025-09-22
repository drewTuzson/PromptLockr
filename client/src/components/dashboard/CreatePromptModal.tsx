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
import { X } from 'lucide-react';
import { useCreatePrompt, useUpdatePrompt } from '@/hooks/usePrompts';
import { Prompt } from '@shared/schema';

import { createPromptSchema } from '@shared/schema';

const promptSchema = createPromptSchema.extend({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  content: z.string().min(1, 'Content is required').max(10000, 'Content too long'),
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
  
  const createPrompt = useCreatePrompt();
  const updatePrompt = useUpdatePrompt();
  
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
      form.reset({
        title: editingPrompt.title || '',
        content: editingPrompt.content || '',
        platform: editingPrompt.platform || 'ChatGPT',
        tags: editingPrompt.tags || [],
        isFavorite: editingPrompt.isFavorite || false,
      });
      setTags(editingPrompt.tags || []);
    } else {
      form.reset({
        title: '',
        content: '',
        platform: 'ChatGPT',
        tags: [],
        isFavorite: false,
      });
      setTags([]);
    }
  }, [editingPrompt, form]);

  const onSubmit = async (data: PromptFormData) => {
    try {
      const promptData = {
        ...data,
        tags,
      };

      if (editingPrompt) {
        await updatePrompt.mutateAsync({
          id: editingPrompt.id,
          ...promptData,
          platform: promptData.platform as 'ChatGPT' | 'Claude' | 'Midjourney' | 'DALL-E' | 'Other',
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
    onClose();
  };

  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleTagKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
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
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a platform" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ChatGPT">ChatGPT</SelectItem>
                        <SelectItem value="Claude">Claude</SelectItem>
                        <SelectItem value="Midjourney">Midjourney</SelectItem>
                        <SelectItem value="DALL-E">DALL-E</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                  <div className="text-xs text-muted-foreground text-right">
                    {field.value.length} characters
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
              <div className="flex gap-2">
                <Input
                  data-testid="input-tag"
                  placeholder="Add a tag"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={handleTagKeyPress}
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
    </Dialog>
  );
}
