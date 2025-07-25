import { useState, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { X, Image, Video, Smile, AtSign, User, ShoppingBag, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { debounce } from "lodash";
import { TablesInsert } from "@/integrations/supabase/types"; 

// Define interfaces
interface PostData {
  content: string;
  imageUrl?: string;
  feeling?: string;
  tags?: string[];
}

interface MediaState {
  files: File[];
  previewUrls: string[];
}

interface TaggableEntity {
  id: string;
  name: string;
  type: 'user' | 'product' | 'group';
}

interface TaggableEntities {
  users: TaggableEntity[];
  products: TaggableEntity[];
  groups: TaggableEntity[];
}

// Define feelings
const feelings = [
  { emoji: "😊", name: "Happy" },
  { emoji: "😢", name: "Sad" },
  { emoji: "😍", name: "In Love" },
  { emoji: "😴", name: "Sleepy" },
  { emoji: "😃", name: "Excited" },
  { emoji: "😣", name: "Frustrated" },
  { emoji: "🥳", name: "Celebrating" },
  { emoji: "😎", name: "Cool" },
  { emoji: "🤩", name: "Amazed" },
  { emoji: "😌", name: "Relaxed" },
];

interface InstagramStylePostCreatorProps {
  onPostCreated?: () => void;
}

const InstagramStylePostCreator = ({ onPostCreated }: InstagramStylePostCreatorProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [media, setMedia] = useState<MediaState>({ files: [], previewUrls: [] });
  const [selectedFeeling, setSelectedFeeling] = useState<string | null>(null);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const [activeTab, setActiveTab] = useState("users");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch taggable entities separately
  const fetchTaggableEntities = useCallback(async (search: string) => {
    const searchTerm = search.trim().toLowerCase();
    const query = searchTerm ? { search: `%${searchTerm}%` } : {};

    const [usersRes, productsRes, groupsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name')
        .ilike('full_name', query.search || '*')
        .limit(10),
      supabase
        .from('products')
        .select('id, name')
        .ilike('name', query.search || '*')
        .limit(10),
      supabase
        .from('groups')
        .select('id, name')
        .ilike('name', query.search || '*')
        .limit(10),
    ]);

    if (usersRes.error || productsRes.error || groupsRes.error) {
      throw new Error('Failed to fetch taggable entities');
    }

    return {
      users: usersRes.data?.map(user => ({ id: user.id, name: user.full_name || `User_${user.id.slice(0, 8)}`, type: 'user' as const })) || [],
      products: productsRes.data?.map(product => ({ id: product.id, name: product.name, type: 'product' as const })) || [],
      groups: groupsRes.data?.map(group => ({ id: group.id, name: group.name, type: 'group' as const })) || [],
    };
  }, []);

  const { data: taggableEntities = { users: [], products: [], groups: [] }, isLoading: isLoadingTags } = useQuery<TaggableEntities>({
    queryKey: ['taggableEntities', tagSearch],
    queryFn: () => fetchTaggableEntities(tagSearch),
    enabled: isTagModalOpen,
  });

  // Debounced search handler
  const debouncedSetTagSearch = useMemo(
    () => debounce((value: string) => setTagSearch(value), 300),
    []
  );

  // Post creation mutation
  const createPostMutation = useMutation({
    mutationFn: async ({ content, imageUrl, feeling, tags }: PostData) => {
      if (!user) throw new Error('Not authenticated');

      const postData: TablesInsert<'posts'> = {
        user_id: user.id,
        content,
        image_url: imageUrl,
        post_type: 'text',
        //@ts-ignore
        feeling: feeling || null,
        tags: tags || [],
      };

      const { data, error } = await supabase
        .from('posts')
        .insert(postData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['social-feed-posts'] });
      setContent("");
      setMedia({ files: [], previewUrls: [] });
      setSelectedFeeling(null);
      setIsTagModalOpen(false);
      setTagSearch("");
      toast({
        title: "Posted!",
        description: "Your post has been shared with the community.",
      });
      onPostCreated?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create post. Please try again.",
        variant: "destructive",
      });
    },
  });

  // File handling
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).slice(0, 10);
    if (files.length === 0) return;

    setMedia(prev => {
      const newFiles = [...prev.files, ...files].slice(0, 10);
      const newUrls = [...prev.previewUrls, ...files.map(file => URL.createObjectURL(file))].slice(0, 10);
      return { files: newFiles, previewUrls: newUrls };
    });
  }, []);

  const removeFile = useCallback((index: number) => {
    setMedia(prev => {
      URL.revokeObjectURL(prev.previewUrls[index]);
      return {
        files: prev.files.filter((_, i) => i !== index),
        previewUrls: prev.previewUrls.filter((_, i) => i !== index),
      };
    });
  }, []);

  const uploadFileToSupabase = useCallback(async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}_${Date.now()}.${fileExt}`;
      const filePath = `posts/${fileName}`;

      const { error } = await supabase.storage
        .from('posts')
        .upload(filePath, file, { cacheControl: '3600', upsert: false });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('posts')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      return null;
    }
  }, [user]);

  // Post submission
  const handlePost = useCallback(async () => {
    if (!content.trim() && media.files.length === 0 && !selectedFeeling) {
      toast({
        title: "Empty post",
        description: "Please add some content, select a file, or choose a feeling to post.",
        variant: "destructive",
      });
      return;
    }

    let imageUrl: string | undefined;
    if (media.files.length > 0) {
      imageUrl = await uploadFileToSupabase(media.files[0]);
      if (!imageUrl) {
        toast({
          title: "Upload failed",
          description: "Failed to upload image. Please try again.",
          variant: "destructive",
        });
        return;
      }
    }

    // Extract tags from content
    const tags = content.match(/@[\w-]+/g)?.map(tag => tag.slice(1)) || [];

    createPostMutation.mutate({ content, imageUrl, feeling: selectedFeeling, tags });
  }, [content, media.files, selectedFeeling, uploadFileToSupabase, createPostMutation, toast]);

  // Feeling and tag handlers
  const handleFeelingSelect = useCallback((feeling: string) => {
    setSelectedFeeling(feeling);
  }, []);

  const handleTagSelect = useCallback((entity: TaggableEntity) => {
    const tag = `@${entity.name.replace(/\s+/g, '-')}`;
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.slice(0, start) + tag + ' ' + content.slice(end);
      setContent(newContent);
      setTimeout(() => textarea.setSelectionRange(start + tag.length + 1, start + tag.length + 1), 0);
    }
    setIsTagModalOpen(false);
    setTagSearch("");
  }, [content]);

  // User profile
  const userProfile = useMemo(() => ({
    name: user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User',
    avatar: user?.user_metadata?.avatar_url || null,
    username: `@${user?.email?.split('@')[0] || user?.id.slice(0, 8)}`, // Generate @username from email or ID
  }), [user]);

  return (
    <div className=" dark:from-gray-900 dark:to-gray-800 rounded-xl border border-gray-100 dark:border-gray-800 shadow-md overflow-hidden transition-all duration-200 hover:shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Create Post</h3>
        <Button
          onClick={handlePost}
          disabled={createPostMutation.isPending || (!content.trim() && media.files.length === 0 && !selectedFeeling)}
          className="bg-pink-500 text-white font-medium px-4 py-2 rounded-lg hover:bg-pink-600 disabled:bg-pink-300 transition-colors duration-200"
        >
          {createPostMutation.isPending ? 'Sharing...' : 'Share'}
        </Button>
      </div>

      {/* User Info */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center space-x-3">
          {userProfile.avatar ? (
            <Avatar className="w-10 h-10 border border-gray-200 dark:border-gray-700 rounded-full">
              <AvatarImage src={userProfile.avatar} alt={userProfile.name} />
              <AvatarFallback className="bg-pink-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200">{userProfile.name.charAt(0)}</AvatarFallback>
            </Avatar>
          ) : (
            <div className="w-10 h-10 rounded-full bg-pink-200 dark:bg-gray-600 flex items-center justify-center text-gray-800 dark:text-gray-200">
              {userProfile.name.charAt(0)}
            </div>
          )}
          <div>
            <p className="text-base font-medium text-gray-900 dark:text-white truncate">{userProfile.name}</p>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{userProfile.username}</p>
          </div>
          {selectedFeeling && (
            <span className="text-sm font-medium text-pink-600 dark:text-pink-400 flex items-center space-x-1 ml-2">
              <span>{feelings.find(f => f.name === selectedFeeling)?.emoji}</span>
              <span>{selectedFeeling}</span>
            </span>
          )}
        </div>
        <select className="text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-md border border-gray-200 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-pink-500 transition-all duration-200">
          <option className="bg-white dark:bg-gray-800">🌍 Public</option>
          <option className="bg-white dark:bg-gray-800">👥 Friends</option>
          <option className="bg-white dark:bg-gray-800">🔒 Only me</option>
        </select>
      </div>

      {/* Content Input */}
      <div className="px-4 py-3">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's on your mind?"
          className="w-full p-3 text-base text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-pink-500 transition-all duration-200"
          rows={3}
          style={{ minHeight: '70px' }}
        />
      </div>

      {/* Media Preview */}
      {media.previewUrls.length > 0 && (
        <div className="px-4 py-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-80 overflow-y-auto">
            {media.previewUrls.map((url, index) => (
              <div key={index} className="relative group rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                <div className="aspect-square">
                  {media.files[index]?.type.startsWith('video/') ? (
                    <video
                      src={url}
                      className="w-full h-full object-cover rounded-lg"
                      controls={false}
                      muted
                    />
                  ) : (
                    <img
                      src={url}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg hover:scale-105 transition-transform duration-200"
                    />
                  )}
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="absolute top-2 right-2 bg-gray-800 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-pink-500 transition-colors duration-200"
          >
            <Image className="w-5 h-5" />
            <span className="text-sm font-medium">Photo</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-pink-500 transition-colors duration-200"
          >
            <Video className="w-5 h-5" />
            <span className="text-sm font-medium">Video</span>
          </button>
          <Popover>
            <PopoverTrigger asChild>
              <button className="flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-pink-500 transition-colors duration-200">
                <Smile className="w-5 h-5" />
                <span className="text-sm font-medium">Feeling</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 shadow-md">
              <ScrollArea className="h-48">
                <div className="grid grid-cols-1 gap-2 p-2">
                  {feelings.map((feeling) => (
                    <button
                      key={feeling.name}
                      onClick={() => handleFeelingSelect(feeling.name)}
                      className={`flex items-center space-x-2 p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 ${
                        selectedFeeling === feeling.name ? 'bg-pink-100 dark:bg-gray-600 text-pink-600 dark:text-pink-400' : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <span className="text-xl">{feeling.emoji}</span>
                      <span className="text-sm font-medium">{feeling.name}</span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
          <button
            onClick={() => setIsTagModalOpen(true)}
            className="flex items-center space-x-2 text-gray-600 dark:text-gray-300 hover:text-pink-500 transition-colors duration-200"
          >
            <AtSign className="w-5 h-5" />
            <span className="text-sm font-medium">Tag</span>
          </button>
        </div>
        {media.files.length > 0 && (
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md">
            {media.files.length}/10 files
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

      {/* Tag Modal - With tabs for Users, Groups, Products */}
      <Dialog open={isTagModalOpen} onOpenChange={setIsTagModalOpen}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-hidden rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-md">
          <DialogHeader className="pb-3">
            <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">Tag People, Products, or Groups</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Search by name..."
            value={tagSearch}
            onChange={(e) => debouncedSetTagSearch(e.target.value)}
            className="mb-3 w-full text-sm font-medium text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-pink-500 transition-all duration-200 placeholder-gray-400 dark:placeholder-gray-500"
          />
          <Tabs defaultValue="users" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-3 mb-3 bg-gray-100 dark:bg-gray-700 rounded-md p-1">
              <TabsTrigger 
                value="users" 
                className="rounded-md data-[state=active]:bg-pink-500 data-[state=active]:text-white transition-colors duration-200 py-1.5 text-sm font-medium"
              >
                <User className="w-4 h-4 mr-1" /> Users
              </TabsTrigger>
              <TabsTrigger 
                value="groups" 
                className="rounded-md data-[state=active]:bg-pink-500 data-[state=active]:text-white transition-colors duration-200 py-1.5 text-sm font-medium"
              >
                <Users className="w-4 h-4 mr-1" /> Groups
              </TabsTrigger>
              <TabsTrigger 
                value="products" 
                className="rounded-md data-[state=active]:bg-pink-500 data-[state=active]:text-white transition-colors duration-200 py-1.5 text-sm font-medium"
              >
                <ShoppingBag className="w-4 h-4 mr-1" /> Products
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[calc(80vh-250px)] pr-3">
              <TabsContent value="users">
                {isLoadingTags ? (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-2 text-sm">Loading...</p>
                ) : taggableEntities.users.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 py-2 text-center">No users found</p>
                ) : (
                  <div className="space-y-2">
                    {taggableEntities.users.map((entity) => (
                      <button
                        key={`${entity.type}-${entity.id}`}
                        onClick={() => handleTagSelect(entity)}
                        className="flex items-center space-x-3 p-2 w-full text-left bg-white dark:bg-gray-800 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                      >
                        <Avatar className="w-10 h-10">
                          <AvatarFallback className="bg-pink-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200">{entity.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span className="text-base font-medium text-gray-900 dark:text-white">{entity.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="groups">
                {isLoadingTags ? (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-2 text-sm">Loading...</p>
                ) : taggableEntities.groups.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 py-2 text-center">No groups found</p>
                ) : (
                  <div className="space-y-2">
                    {taggableEntities.groups.map((entity) => (
                      <button
                        key={`${entity.type}-${entity.id}`}
                        onClick={() => handleTagSelect(entity)}
                        className="flex items-center space-x-3 p-2 w-full text-left bg-white dark:bg-gray-800 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                      >
                        <div className="w-10 h-10 rounded-full bg-pink-200 dark:bg-gray-600 flex items-center justify-center text-gray-800 dark:text-gray-200">
                          <Users className="w-5 h-5" />
                        </div>
                        <span className="text-base font-medium text-gray-900 dark:text-white">{entity.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="products">
                {isLoadingTags ? (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-2 text-sm">Loading...</p>
                ) : taggableEntities.products.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 py-2 text-center">No products found</p>
                ) : (
                  <div className="space-y-2">
                    {taggableEntities.products.map((entity) => (
                      <button
                        key={`${entity.type}-${entity.id}`}
                        onClick={() => handleTagSelect(entity)}
                        className="flex items-center space-x-3 p-2 w-full text-left bg-white dark:bg-gray-800 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                      >
                        <div className="w-10 h-10 rounded-full bg-pink-200 dark:bg-gray-600 flex items-center justify-center text-gray-800 dark:text-gray-200">
                          <ShoppingBag className="w-5 h-5" />
                        </div>
                        <span className="text-base font-medium text-gray-900 dark:text-white">{entity.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InstagramStylePostCreator;