
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import UserProfileHeader from "@/components/UserProfileHeader";
import SocialProfileTabs from "@/components/SocialProfileTabs";

const UserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user, profile: currentUserProfile, updateProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    bio: '',
    website: '',
    location: '',
    avatar_url: '',
  });

  const isOwnProfile = userId === user?.id || !userId;
  const profileUserId = userId || user?.id || '';

  // Fetch user profile
  const { data: profile, isLoading } = useQuery({
    queryKey: ['user-profile', profileUserId],
    queryFn: async () => {
      if (!profileUserId) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileUserId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!profileUserId,
  });

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      const { error } = await updateProfile(profileForm);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditingProfile(false);
      queryClient.invalidateQueries({ queryKey: ['user-profile', profileUserId] });
      toast({ title: "Profile updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleEditProfile = () => {
    setProfileForm({
      full_name: profile?.full_name || '',
      bio: profile?.bio || '',
      website: profile?.website || '',
      location: profile?.location || '',
      avatar_url: profile?.avatar_url || '',
    });
    setEditingProfile(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="flex items-center gap-6">
              <div className="w-32 h-32 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
              <div className="space-y-3">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-64"></div>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <div className="max-w-4xl mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">User not found</h1>
          <Button onClick={() => navigate(-1)} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      
      <UserProfileHeader
        profileUserId={profileUserId}
        profile={profile}
        isOwnProfile={isOwnProfile}
        onEditProfile={handleEditProfile}
      />
      
      <div className="py-8">
        <SocialProfileTabs 
          profileUserId={profileUserId}
          isOwnProfile={isOwnProfile}
        />
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={editingProfile} onOpenChange={setEditingProfile}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={profileForm.full_name}
                onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={profileForm.bio}
                onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                placeholder="Tell us about yourself..."
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={profileForm.website}
                onChange={(e) => setProfileForm({ ...profileForm, website: e.target.value })}
                placeholder="https://yourwebsite.com"
              />
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={profileForm.location}
                onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })}
                placeholder="City, Country"
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={() => updateProfileMutation.mutate()}
                disabled={updateProfileMutation.isPending}
                className="flex-1"
              >
                {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button variant="outline" onClick={() => setEditingProfile(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      <Footer />
    </div>
  );
};

export default UserProfile;
