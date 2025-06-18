
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X, Image, Video, Smile, MapPin, Plus, Tag, Star, ShoppingBag } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface InstagramStylePostCreatorProps {
  onPostCreated?: () => void;
}

const InstagramStylePostCreator = ({ onPostCreated }: InstagramStylePostCreatorProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [selectedLabel, setSelectedLabel] = useState<string>("none");
  const [starRating, setStarRating] = useState<number>(0);
  const [taggedProducts, setTaggedProducts] = useState<string[]>([]);
  const [showProductDialog, setShowProductDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch user's products for tagging
  const { data: userProducts } = useQuery({
    queryKey: ['user-products', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('vendor_id', user.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user
  });

  const createPostMutation = useMutation({
    mutationFn: async ({ content, imageUrl }: { content: string; imageUrl?: string }) => {
      if (!user) throw new Error('Not authenticated');
      

      
      const { data: post, error } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content,
          image_url: imageUrl,
          post_type: imageUrl ? 'image' : 'text',
          label: selectedLabel,
          star_rating: selectedLabel === 'review' ? starRating : null
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error creating post:', error);
        throw error;
      }
      
      // Add product tags if any are selected
      if (taggedProducts.length > 0 && post) {
        const tagInserts = taggedProducts.map((productId, index) => ({
          post_id: post.id,
          product_id: productId,
          tag_order: index + 1
        }));
        
        // Product tags feature ready for future implementation
      }
      
      return post;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['social-feed-posts'] });
      setContent("");
      setSelectedFiles([]);
      setPreviewUrls([]);
      setSelectedLabel("none");
      setStarRating(0);
      setTaggedProducts([]);
      toast({
        title: "Posted!",
        description: "Your post has been shared with the community.",
      });
      onPostCreated?.();
    },
    onError: (error) => {
      console.error('Error creating post:', error);
      toast({
        title: "Error",
        description: "Failed to create post. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Limit to 10 files like Instagram
    const limitedFiles = files.slice(0, 10);
    setSelectedFiles(prev => [...prev, ...limitedFiles].slice(0, 10));

    // Create preview URLs
    limitedFiles.forEach(file => {
      const url = URL.createObjectURL(file);
      setPreviewUrls(prev => [...prev, url]);
    });
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    URL.revokeObjectURL(previewUrls[index]);
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFileToSupabase = async (file: File): Promise<string | null> => {
    try {
      console.log('Uploading file to Supabase:', file.name);
      
      // Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}_${Date.now()}.${fileExt}`;
      const filePath = `posts/${fileName}`;

      console.log('Uploading to path:', filePath);

      const { data, error } = await supabase.storage
        .from('posts')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Upload error:', error);
        throw error;
      }

      console.log('File uploaded successfully:', data);

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('posts')
        .getPublicUrl(filePath);

      console.log('Generated public URL:', publicUrl);
      return publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      return null;
    }
  };

  const handlePost = async () => {
    if (!content.trim() && selectedFiles.length === 0) {
      toast({
        title: "Empty post",
        description: "Please add some content or select a file to post.",
        variant: "destructive"
      });
      return;
    }

    let imageUrl = undefined;
    if (selectedFiles.length > 0) {
      console.log('Starting file upload process...');
      // Upload the first file to Supabase Storage
      imageUrl = await uploadFileToSupabase(selectedFiles[0]);
      if (!imageUrl) {
        toast({
          title: "Upload failed",
          description: "Failed to upload image. Please try again.",
          variant: "destructive"
        });
        return;
      }
      console.log('File upload completed, URL:', imageUrl);
    }

    console.log('Submitting post with image URL:', imageUrl);
    createPostMutation.mutate({ content, imageUrl });
  };

  // Get user profile data
  const userProfile = user ? {
    name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
    avatar: user.user_metadata?.avatar_url || null
  } : null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">Create post</h3>
        <Button
          onClick={handlePost}
          disabled={createPostMutation.isPending || (!content.trim() && selectedFiles.length === 0)}
          className="bg-pink-500 hover:bg-pink-600 text-white font-semibold px-6 py-1 rounded-lg disabled:opacity-50"
        >
          {createPostMutation.isPending ? 'Sharing...' : 'Share'}
        </Button>
      </div>

      {/* User Info */}
      <div className="flex items-center p-4 pb-2">
        {userProfile?.avatar ? (
          <Avatar className="w-10 h-10 mr-3">
            <AvatarImage src={userProfile.avatar} alt={userProfile.name} />
            <AvatarFallback>{userProfile.name.charAt(0)}</AvatarFallback>
          </Avatar>
        ) : (
          <div className="w-10 h-10 mr-3 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white font-medium">
            {userProfile?.name.charAt(0) || 'U'}
          </div>
        )}
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{userProfile?.name || 'User'}</p>
          <select className="text-sm text-gray-600 dark:text-gray-400 bg-transparent border-none outline-none">
            <option>🌍 Public</option>
            <option>👥 Friends</option>
            <option>🔒 Only me</option>
          </select>
        </div>
      </div>

      {/* Content Input */}
      <div className="px-4">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's on your mind?"
          className="w-full p-0 text-lg placeholder-gray-500 dark:placeholder-gray-400 bg-transparent border-none outline-none resize-none text-gray-900 dark:text-white"
          rows={3}
          style={{ minHeight: '60px' }}
        />
      </div>

      {/* Media Preview */}
      {previewUrls.length > 0 && (
        <div className="px-4 py-2">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-96 overflow-y-auto">
            {previewUrls.map((url, index) => (
              <div key={index} className="relative group">
                <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                  {selectedFiles[index]?.type.startsWith('video/') ? (
                    <video 
                      src={url} 
                      className="w-full h-full object-cover"
                      controls={false}
                      muted
                    />
                  ) : (
                    <img 
                      src={url} 
                      alt={`Preview ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="absolute top-2 right-2 bg-gray-800 bg-opacity-70 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-pink-500 transition-colors"
          >
            <Image className="w-5 h-5" />
            <span className="text-sm font-medium">Photo</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-pink-500 transition-colors"
          >
            <Video className="w-5 h-5" />
            <span className="text-sm font-medium">Video</span>
          </button>
          <button className="flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-pink-500 transition-colors">
            <Smile className="w-5 h-5" />
            <span className="text-sm font-medium">Feeling</span>
          </button>
          <button className="flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-pink-500 transition-colors">
            <MapPin className="w-5 h-5" />
            <span className="text-sm font-medium">Location</span>
          </button>
        </div>
        
        {selectedFiles.length > 0 && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {selectedFiles.length}/10 files
          </span>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
};

export default InstagramStylePostCreator;
