
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Heart, MessageCircle, Share, Plus, Image } from "lucide-react";
import Layout from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import CommentsDialog from "@/components/CommentsDialog";
import InstagramStylePostCreator from "@/components/InstagramStylePostCreator";
import { useNavigate } from "react-router-dom";

const Feed = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedPostForComments, setSelectedPostForComments] = useState<string | null>(null);

  // Fetch posts from database
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['posts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles:user_id (
            full_name,
            email,
            avatar_url
          ),
          post_likes!left (
            user_id
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return data.map(post => ({
        ...post,
        user: {
          id: post.user_id,
          name: post.profiles?.full_name || post.profiles?.email?.split('@')[0] || 'Unknown User',
          avatar: post.profiles?.avatar_url || null, // Don't use fallback here
          username: `@${post.profiles?.email?.split('@')[0] || 'user'}`
        },
        liked: post.post_likes?.some(like => like.user_id === user?.id) || false
      }));
    },
    enabled: !!user
  });

  // Like post mutation
  const likePostMutation = useMutation({
    mutationFn: async ({ postId, isLiked }: { postId: string; isLiked: boolean }) => {
      if (!user) throw new Error('Not authenticated');
      
      if (isLiked) {
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('post_likes')
          .insert({
            post_id: postId,
            user_id: user.id
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
    onError: (error) => {
      console.error('Error toggling like:', error);
      toast({
        title: "Error",
        description: "Failed to update like. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleLike = (postId: string, isLiked: boolean) => {
    likePostMutation.mutate({ postId, isLiked });
  };

  const handleShare = async (postId: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Check out this post',
          text: 'Check out this amazing post!',
          url: `${window.location.origin}/posts/${postId}`,
        });
      } catch (error) {
        console.log('Share failed:', error);
      }
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(`${window.location.origin}/posts/${postId}`).then(() => {
        toast({
          title: "Link copied!",
          description: "Post link copied to clipboard.",
        });
      });
    } else {
      toast({
        title: "Share feature coming soon!",
        description: "Advanced sharing options will be available soon.",
      });
    }
  };

  const handleUserClick = (userId: string) => {
    navigate(`/users/${userId}`);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-b from-white to-pink-50">
          <div className="container mx-auto px-4 py-8">
            <div className="max-w-2xl mx-auto">
              <div className="animate-pulse space-y-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="smooth-card p-6">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="min-h-screen bg-gradient-to-b from-white to-pink-50 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            {/* Instagram-style Post Creator */}
            <div className="mb-8">
              <InstagramStylePostCreator />
            </div>

            {/* Posts Feed */}
            <div className="space-y-6">
              {posts.map((post) => (
                <div key={post.id} className="smooth-card p-6 animate-fade-in dark:bg-gray-800 dark:border-gray-700">
                  <div className="flex items-center mb-4">
                    {post.user.avatar ? (
                      <Avatar 
                        className="w-12 h-12 mr-4 cursor-pointer hover:ring-2 hover:ring-pink-300 transition-all"
                        onClick={() => handleUserClick(post.user.id)}
                      >
                        <AvatarImage src={post.user.avatar} alt={post.user.name} />
                        <AvatarFallback>{post.user.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                    ) : (
                      <div 
                        className="w-12 h-12 mr-4 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white font-medium cursor-pointer hover:ring-2 hover:ring-pink-300 transition-all"
                        onClick={() => handleUserClick(post.user.id)}
                      >
                        {post.user.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <h3 
                        className="font-semibold cursor-pointer hover:text-pink-500 transition-colors dark:text-white dark:hover:text-pink-400"
                        onClick={() => handleUserClick(post.user.id)}
                      >
                        {post.user.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{post.user.username}</p>
                    </div>
                  </div>
                  
                  <p className="mb-4 text-gray-700 dark:text-gray-300">{post.content}</p>
                  
                  {post.image_url && (
                    <div className="mb-4 rounded-2xl overflow-hidden">
                      <img 
                        src={post.image_url} 
                        alt="Post content"
                        className="w-full h-64 object-cover hover:scale-105 transition-transform duration-300 cursor-pointer"
                      />
                    </div>
                  )}
                  
                  <div className="border-t border-pink-100 dark:border-gray-600 pt-4">
                    <div className="flex items-center justify-between">
                      <Button 
                        variant="ghost" 
                        onClick={() => handleLike(post.id, post.liked)}
                        disabled={likePostMutation.isPending}
                        className={`flex items-center space-x-2 rounded-xl ${
                          post.liked 
                            ? 'text-pink-500 hover:bg-pink-50 dark:hover:bg-pink-900/20' 
                            : 'text-gray-600 hover:text-pink-500 hover:bg-pink-50 dark:text-gray-400 dark:hover:text-pink-400 dark:hover:bg-pink-900/20'
                        }`}
                      >
                        <Heart className={`w-5 h-5 ${post.liked ? 'fill-current' : ''}`} />
                        <span>{post.likes_count || 0}</span>
                      </Button>
                      
                      <Button 
                        variant="ghost" 
                        onClick={() => setSelectedPostForComments(post.id)}
                        className="flex items-center space-x-2 text-gray-600 hover:text-pink-500 hover:bg-pink-50 rounded-xl dark:text-gray-400 dark:hover:text-pink-400 dark:hover:bg-pink-900/20"
                      >
                        <MessageCircle className="w-5 h-5" />
                        <span>{post.comments_count || 0}</span>
                      </Button>
                      
                      <Button 
                        variant="ghost" 
                        onClick={() => handleShare(post.id)}
                        className="flex items-center space-x-2 text-gray-600 hover:text-pink-500 hover:bg-pink-50 rounded-xl dark:text-gray-400 dark:hover:text-pink-400 dark:hover:bg-pink-900/20"
                      >
                        <Share className="w-5 h-5" />
                        <span>{post.shares_count || 0}</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              
              {posts.length === 0 && (
                <div className="text-center py-12">
                  <MessageCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">No posts yet</h3>
                  <p className="text-gray-500 dark:text-gray-400">Be the first to share something with the community!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Comments Dialog */}
      <CommentsDialog
        postId={selectedPostForComments || ""}
        isOpen={!!selectedPostForComments}
        onOpenChange={(open) => !open && setSelectedPostForComments(null)}
      />
    </Layout>
  );
};

export default Feed;
