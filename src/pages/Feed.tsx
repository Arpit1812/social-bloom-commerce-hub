import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Heart, MessageCircle, Share, Plus, Image, ArrowUp } from "lucide-react";
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

// Define feelings (same as in post creator)
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

const Feed = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedPostForComments, setSelectedPostForComments] = useState<
    string | null
  >(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  // Handle scroll event to show/hide scroll-to-top button
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollToTop(true);
      } else {
        setShowScrollToTop(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Function to scroll to top with smooth animation
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // Fetch posts from database (assuming 'feeling' is a column in posts table)
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ["posts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("posts")
        .select(
          `
          *,
          profiles:user_id (
            full_name,
            email,
            avatar_url
          ),
          post_likes (user_id),
          comment_count: post_comments (count)
        `
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data.map((post) => ({
        ...post,
        user: {
          id: post.user_id,
          name:
            post.profiles?.full_name ||
            post.profiles?.email?.split("@")[0] ||
            "Unknown User",
          avatar: post.profiles?.avatar_url || null,
          username: `@${post.profiles?.email?.split("@")[0] || "user"}`,
        },
        liked:
          post.post_likes?.some((like) => like.user_id === user?.id) || false,
        likes_count: post.post_likes?.length || 0,
        comments_count: post.comment_count?.[0]?.count || 0,
        //@ts-ignore
        feeling: post.feeling || null, // Ensure feeling property is properly included in the object
      }));
    },
    enabled: !!user,
  });

  // Like post mutation
  const likePostMutation = useMutation({
    mutationFn: async ({
      postId,
      isLiked,
    }: {
      postId: string;
      isLiked: boolean;
    }) => {
      if (!user) throw new Error("Not authenticated");

      if (isLiked) {
        const { error } = await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("post_likes").insert({
          post_id: postId,
          user_id: user.id,
        });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (error) => {
      console.error("Error toggling like:", error);
      toast({
        title: "Error",
        description: "Failed to update like. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleLike = (
    e: React.MouseEvent,
    postId: string,
    isLiked: boolean
  ) => {
    e.stopPropagation();
    likePostMutation.mutate({ postId, isLiked });
  };

  const handleShare = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Check out this post",
          text: "Check out this amazing post!",
          url: `${window.location.origin}/posts/${postId}`,
        });
      } catch (error) {
        console.log("Share failed:", error);
      }
    } else if (navigator.clipboard) {
      navigator.clipboard
        .writeText(`${window.location.origin}/posts/${postId}`)
        .then(() => {
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

  const handleUserClick = (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    navigate(`/users/${userId}`);
  };

  // Handle click on tagged entity
  const handleTagClick = async (e: React.MouseEvent, tag: string) => {
    e.stopPropagation();
    const cleanTag = tag.slice(1); // Remove '@' symbol
    // Fetch entity details to determine type (simplified approach)
    const [userRes, productRes, groupRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id")
        .ilike("full_name", `%${cleanTag}%`)
        .limit(1),
      supabase
        .from("products")
        .select("id")
        .ilike("name", `%${cleanTag}%`)
        .limit(1),
      supabase
        .from("groups")
        .select("id")
        .ilike("name", `%${cleanTag}%`)
        .limit(1),
    ]);

    if (userRes.data?.length) {
      navigate(`/users/${userRes.data[0].id}`);
    } else if (productRes.data?.length) {
      navigate(`/products/${productRes.data[0].id}`);
    } else if (groupRes.data?.length) {
      navigate(`/groups/${groupRes.data[0].id}`);
    } else {
      toast({
        title: "Not Found",
        description: "The tagged entity could not be found.",
        variant: "destructive",
      });
    }
  };

  const handleCommentClick = (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    setSelectedPostForComments(postId);
  };

  const handlePostClick = (postId: string) => {
    setSelectedPostForComments(postId);
  };

  // Render content with highlighted tags
  const renderContentWithTags = (content: string, postId: string) => {
    const tagRegex = /@[\w-]+/g;
    const parts = content.split(tagRegex);
    const tags = content.match(tagRegex) || [];

    return parts.reduce((acc, part, index) => {
      acc.push(<span key={`part-${index}`}>{part}</span>);
      if (index < tags.length) {
        acc.push(
          <span
            key={`tag-${index}`}
            className="text-pink-500 underline cursor-pointer"
            onClick={(e) => handleTagClick(e, tags[index])}
          >
            {tags[index]}
          </span>
        );
      }
      return acc;
    }, [] as JSX.Element[]);
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
                <div
                  key={post.id}
                  className="smooth-card rounded-xl p-6 animate-fade-in dark:bg-gray-800 dark:border-gray-700 cursor-pointer"
                  onClick={() => handlePostClick(post.id)}
                >
                  <div className="flex items-center mb-4">
                    {post.user.avatar ? (
                      <Avatar
                        className="w-12 h-12 mr-4 cursor-pointer hover:ring-2 hover:ring-pink-300 transition-all"
                        onClick={(e) => handleUserClick(e, post.user.id)}
                      >
                        <AvatarImage
                          src={post.user.avatar}
                          alt={post.user.name}
                        />
                        <AvatarFallback>
                          {post.user.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    ) : (
                      <div
                        className="w-12 h-12 mr-4 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white font-medium cursor-pointer hover:ring-2 hover:ring-pink-300 transition-all"
                        onClick={(e) => handleUserClick(e, post.user.id)}
                      >
                        {post.user.name.charAt(0)}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center space-x-2">
                        <h3
                          className="font-semibold cursor-pointer hover:text-pink-500 transition-colors dark:text-white dark:hover:text-pink-400"
                          onClick={(e) => handleUserClick(e, post.user.id)}
                        >
                          {post.user.name}
                        </h3>
                        {post.feeling && (
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            is feeling{" "}
                            {
                              feelings.find((f) => f.name === post.feeling)
                                ?.emoji
                            }{" "}
                            {post.feeling}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {post.user.username}
                      </p>
                    </div>
                  </div>

                  <div className="mb-4 text-gray-700 dark:text-gray-300">
                    {renderContentWithTags(post.content, post.id)}
                  </div>

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
                        onClick={(e) => handleLike(e, post.id, post.liked)}
                        disabled={likePostMutation.isPending}
                        className={`flex items-center space-x-2 rounded-xl ${
                          post.liked
                            ? "text-pink-500 hover:bg-pink-50 dark:hover:bg-pink-900/20"
                            : "text-gray-600 hover:text-pink-500 hover:bg-pink-50 rounded-xl dark:text-gray-400 dark:hover:text-pink-400 dark:hover:bg-pink-900/20"
                        }`}
                      >
                        <Heart
                          className={`w-5 h-5 ${
                            post.liked ? "fill-current" : ""
                          }`}
                        />
                        <span>{post.likes_count || 0}</span>
                      </Button>

                      <Button
                        variant="ghost"
                        onClick={(e) => handleCommentClick(e, post.id)}
                        className="flex items-center space-x-2 text-gray-600 hover:text-pink-500 hover:bg-pink-50 rounded-xl dark:text-gray-400 dark:hover:text-pink-400 dark:hover:bg-pink-900/20"
                      >
                        <MessageCircle className="w-5 h-5" />
                        <span>{post.comments_count || 0}</span>
                      </Button>

                      <Button
                        variant="ghost"
                        onClick={(e) => handleShare(e, post.id)}
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
                  <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-300 mb-2">
                    No posts yet
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Be the first to share something with the community!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Scroll to Top Button */}
        <Button
          variant="default"
          size="icon"
          onClick={scrollToTop}
          className={`fixed bottom-8 right-4 rounded-full bg-primary hover:bg-primary/90 text-white shadow-lg transition-all duration-300 ease-in-out z-50 ${
            showScrollToTop
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-4 pointer-events-none"
          }`}
        >
          <ArrowUp className="h-5 w-5" />
        </Button>
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