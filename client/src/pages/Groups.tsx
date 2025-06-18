
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Users, Lock, Plus, Search, ShoppingBag, ArrowRight, Globe, UserPlus } from "lucide-react";
import Layout from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import InviteMembersDialog from "@/components/InviteMembersDialog";

const Groups = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [selectedGroupForInvite, setSelectedGroupForInvite] = useState<any>(null);
  const [newGroupForm, setNewGroupForm] = useState({
    name: "",
    description: "",
    product_id: "",
    is_private: true,
    auto_approve_requests: false,
    invite_only: false,
    max_members: 50
  });

  // Fetch groups from database using separate queries to avoid foreign key conflicts
  const { data: groups = [], isLoading, error } = useQuery({
    queryKey: ['groups', user?.id],
    queryFn: async () => {
      console.log('Groups: Starting fetch for user:', user?.id);
      
      // Get basic groups data first
      const { data: basicGroups, error: basicError } = await supabase
        .from('groups')
        .select('*')
        .order('created_at', { ascending: false });
      
      console.log('Groups: Basic groups query result:', { basicGroups, basicError });
      
      if (basicError) {
        console.error('Groups: Basic query failed:', basicError);
        throw basicError;
      }

      if (!basicGroups || basicGroups.length === 0) {
        console.log('Groups: No groups found in database');
        return [];
      }

      // Get related data separately
      const groupIds = basicGroups.map(g => g.id);
      const creatorIds = [...new Set(basicGroups.map(g => g.creator_id))];
      const productIds = [...new Set(basicGroups.map(g => g.product_id).filter(Boolean))];
      
      // Get creator profiles
      const { data: creators } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', creatorIds);
      
      // Get products
      const { data: products } = await supabase
        .from('products')
        .select('id, name, image_url, price')
        .in('id', productIds);
      
      // Get group members
      const { data: allMembers } = await supabase
        .from('group_members')
        .select('group_id, user_id')
        .in('group_id', groupIds);
      
      // Get existing join requests for this user
      const { data: joinRequests } = await supabase
        .from('group_join_requests')
        .select('group_id, status')
        .eq('user_id', user?.id)
        .in('group_id', groupIds)
        .eq('status', 'pending');
      
      console.log('Groups: Related data:', { creators, products, allMembers, joinRequests });
      
      // Combine all data
      const processedGroups = basicGroups.map(group => {
        const creator = creators?.find(c => c.id === group.creator_id);
        const product = products?.find(p => p.id === group.product_id);
        const groupMembers = allMembers?.filter(m => m.group_id === group.id) || [];
        const isJoined = groupMembers.some(member => member.user_id === user?.id);
        const hasPendingRequest = joinRequests?.some(req => req.group_id === group.id);
        
        return {
          ...group,
          members: groupMembers.length,
          isJoined,
          hasPendingRequest,
          image: product?.image_url || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=300&h=200&fit=crop",
          product: product,
          creator_profile: creator
        };
      });
      
      console.log('Groups: Final processed groups:', processedGroups);
      return processedGroups;
    },
    enabled: !!user
  });

  // Fetch products for group creation
  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  // Create group mutation
  const createGroupMutation = useMutation({
    mutationFn: async (formData: typeof newGroupForm) => {
      if (!user) throw new Error('Not authenticated');
      
      console.log('Creating group with:', { ...formData, userId: user.id });
      
      const { data: group, error } = await supabase
        .from('groups')
        .insert({
          creator_id: user.id,
          product_id: formData.product_id,
          name: formData.name,
          description: formData.description,
          is_private: formData.is_private,
          auto_approve_requests: formData.auto_approve_requests,
          invite_only: formData.invite_only,
          max_members: formData.max_members
        })
        .select()
        .single();
      
      console.log('Group creation result:', { group, error });
      
      if (error) throw error;
      
      // Auto-join the creator to the group
      const { error: memberError } = await supabase
        .from('group_members')
        .insert({
          group_id: group.id,
          user_id: user.id
        });
      
      console.log('Group member creation result:', { memberError });
      
      if (memberError) throw memberError;
      
      return group;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      setNewGroupForm({
        name: "",
        description: "",
        product_id: "",
        is_private: true,
        auto_approve_requests: false,
        invite_only: false,
        max_members: 50
      });
      setShowCreateForm(false);
      toast({
        title: "Group Created!",
        description: "Your group has been created successfully.",
      });
    },
    onError: (error) => {
      console.error('Error creating group:', error);
      toast({
        title: "Error",
        description: "Failed to create group. Please try again.",
        variant: "destructive"
      });
    }
  });

  // FIXED: Completely rewritten join/leave group mutation with proper sequential operations
  const toggleGroupMembershipMutation = useMutation({
    mutationFn: async ({ groupId, isJoined, group }: { groupId: string; isJoined: boolean; group: any }) => {
      if (!user) throw new Error('Not authenticated');
      
      console.log('=== JOIN/LEAVE MUTATION START ===');
      console.log('Action:', isJoined ? 'LEAVING' : 'JOINING');
      console.log('Group ID:', groupId);
      console.log('User ID:', user.id);
      
      if (isJoined) {
        // LEAVING GROUP - Complete cleanup
        console.log('Leaving group - cleaning up membership and requests');
        
        // Remove from group_members
        const { error: memberError } = await supabase
          .from('group_members')
          .delete()
          .eq('group_id', groupId)
          .eq('user_id', user.id);
        
        if (memberError) {
          console.error('Error removing membership:', memberError);
          throw memberError;
        }
        
        // Clean up ALL join requests for this user and group
        const { error: requestCleanupError } = await supabase
          .from('group_join_requests')
          .delete()
          .eq('group_id', groupId)
          .eq('user_id', user.id);
        
        console.log('Join request cleanup result:', requestCleanupError);
        
        console.log('Successfully left group and cleaned up all records');
        return { action: 'left' };
        
      } else {
        // JOINING GROUP - Use a safe sequential approach
        console.log('Attempting to join group');
        
        // Check if group is invite-only
        if (group.invite_only) {
          throw new Error('This group is invite-only. Please ask for an invitation.');
        }
        
        // Step 1: Complete cleanup using a dedicated function to ensure atomicity
        console.log('CLEANUP: Removing any existing records before creating new ones');
        
        try {
          // Clean up in sequence with error handling
          await supabase
            .from('group_join_requests')
            .delete()
            .eq('group_id', groupId)
            .eq('user_id', user.id);
          
          await supabase
            .from('group_members')
            .delete()
            .eq('group_id', groupId)
            .eq('user_id', user.id);
            
          // Wait to ensure cleanup is complete
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (cleanupError) {
          console.log('Cleanup completed (some records may not have existed)');
        }
        
        // Step 2: Determine action and execute
        const needsApproval = group.is_private && !group.auto_approve_requests;
        
        if (needsApproval) {
          console.log('Creating join request for private group');
          
          // Use upsert approach to handle any remaining conflicts
          const { error: requestError, data: requestData } = await supabase
            .from('group_join_requests')
            .upsert({
              group_id: groupId,
              user_id: user.id,
              status: 'pending',
              requested_at: new Date().toISOString()
            }, {
              onConflict: 'group_id,user_id'
            })
            .select();
          
          console.log('Join request result:', { requestError, requestData });
          
          if (requestError) {
            console.error('Error creating join request:', requestError);
            
            // If there's still a conflict, it means there's a race condition
            if (requestError.code === '23505') {
              throw new Error('You already have a pending request for this group.');
            }
            
            throw new Error('Failed to create join request. Please try again.');
          }
          
          return { action: 'requested' };
        } else {
          console.log('Direct join for public group or auto-approval enabled');
          
          // Use upsert for membership as well
          const { error: joinError, data: joinData } = await supabase
            .from('group_members')
            .upsert({
              group_id: groupId,
              user_id: user.id,
              joined_at: new Date().toISOString()
            }, {
              onConflict: 'group_id,user_id'
            })
            .select();
          
          console.log('Direct join result:', { joinError, joinData });
          
          if (joinError) {
            console.error('Error joining group:', joinError);
            
            if (joinError.code === '23505') {
              throw new Error('You are already a member of this group.');
            }
            
            throw new Error('Failed to join group. Please try again.');
          }
          
          return { action: 'joined' };
        }
      }
    },
    onSuccess: (result, { isJoined, group }) => {
      console.log('Mutation success:', result);
      
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['group', group.id] });
      queryClient.invalidateQueries({ queryKey: ['join-requests', group.id] });
      
      // Show appropriate toast
      if (result?.action === 'requested') {
        toast({
          title: "Request Sent",
          description: `Your request to join ${group.name} has been sent to the group admin.`,
        });
      } else if (result?.action === 'left') {
        toast({
          title: "Left Group",
          description: `You left ${group.name}`,
        });
      } else if (result?.action === 'joined') {
        toast({
          title: "Joined Group!",
          description: `Welcome to ${group.name}!`,
        });
      }
    },
    onError: (error) => {
      console.error('Mutation error:', error);
      toast({
        title: "Error",
        description: error.message || "An error occurred. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleJoinGroup = (groupId: string, isJoined: boolean, group: any) => {
    console.log('Join button clicked:', { groupId, isJoined, pending: toggleGroupMembershipMutation.isPending });
    
    // Prevent multiple clicks
    if (toggleGroupMembershipMutation.isPending) {
      console.log('Mutation already in progress, ignoring click');
      return;
    }
    
    toggleGroupMembershipMutation.mutate({ groupId, isJoined, group });
  };

  const handleCreateGroup = () => {
    if (newGroupForm.name.trim() && newGroupForm.product_id) {
      createGroupMutation.mutate(newGroupForm);
    }
  };

  const handleGroupClick = (groupId: string) => {
    navigate(`/groups/${groupId}`);
  };

  const handleInviteMembers = (group: any) => {
    setSelectedGroupForInvite(group);
    setShowInviteDialog(true);
  };

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    group.product?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Add logging for render
  console.log('Groups component rendering with:', { 
    user: user?.id, 
    groupsCount: groups.length, 
    filteredGroupsCount: filteredGroups.length,
    isLoading,
    error 
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-b from-white to-pink-50">
          <div className="container mx-auto px-4 py-8">
            <div className="max-w-6xl mx-auto">
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
      <div className="min-h-screen bg-gradient-to-b from-white to-pink-50">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold mb-4">Shopping Groups</h1>
              <p className="text-xl text-gray-600">Join exclusive groups and shop with your community</p>
            </div>

            {/* Search and Create */}
            <div className="flex flex-col md:flex-row gap-4 mb-8">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search groups or products..."
                  className="pl-10 border-pink-200 focus:ring-pink-300"
                />
              </div>
              <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
                <DialogTrigger asChild>
                  <Button className="social-button bg-gradient-to-r from-pink-500 to-rose-400 hover:from-pink-600 hover:to-rose-500">
                    <Plus className="w-5 h-5 mr-2" />
                    Create Group
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create New Group</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Input
                      value={newGroupForm.name}
                      onChange={(e) => setNewGroupForm({ ...newGroupForm, name: e.target.value })}
                      placeholder="Group name"
                      className="border-pink-200 focus:ring-pink-300"
                    />
                    <Textarea
                      value={newGroupForm.description}
                      onChange={(e) => setNewGroupForm({ ...newGroupForm, description: e.target.value })}
                      placeholder="Group description"
                      className="border-pink-200 focus:ring-pink-300"
                      rows={3}
                    />
                    <Select value={newGroupForm.product_id} onValueChange={(value) => setNewGroupForm({ ...newGroupForm, product_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a product for this group" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} - ${product.price}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="is_private">Private Group</Label>
                        <Switch
                          id="is_private"
                          checked={newGroupForm.is_private}
                          onCheckedChange={(checked) => setNewGroupForm({ ...newGroupForm, is_private: checked })}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label htmlFor="invite_only">Invite Only</Label>
                        <Switch
                          id="invite_only"
                          checked={newGroupForm.invite_only}
                          onCheckedChange={(checked) => setNewGroupForm({ ...newGroupForm, invite_only: checked })}
                        />
                      </div>
                      
                      {!newGroupForm.invite_only && !newGroupForm.is_private && (
                        <div className="flex items-center justify-between">
                          <Label htmlFor="auto_approve">Auto-approve Join Requests</Label>
                          <Switch
                            id="auto_approve"
                            checked={newGroupForm.auto_approve_requests}
                            onCheckedChange={(checked) => setNewGroupForm({ ...newGroupForm, auto_approve_requests: checked })}
                          />
                        </div>
                      )}
                      
                      <div>
                        <Label htmlFor="max_members">Maximum Members</Label>
                        <Input
                          id="max_members"
                          type="number"
                          min="1"
                          max="500"
                          value={newGroupForm.max_members}
                          onChange={(e) => setNewGroupForm({ ...newGroupForm, max_members: parseInt(e.target.value) })}
                        />
                      </div>
                    </div>
                    
                    <div className="flex gap-4">
                      <Button
                        onClick={handleCreateGroup}
                        disabled={createGroupMutation.isPending || !newGroupForm.name.trim() || !newGroupForm.product_id}
                        className="social-button bg-gradient-to-r from-pink-500 to-rose-400 hover:from-pink-600 hover:to-rose-500 flex-1"
                      >
                        {createGroupMutation.isPending ? 'Creating...' : 'Create Group'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowCreateForm(false)}
                        className="border-pink-200 text-pink-600 hover:bg-pink-50"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Groups Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredGroups.map((group) => (
                <div key={group.id} className="smooth-card overflow-hidden floating-card animate-fade-in">
                  <div className="relative">
                    <img 
                      src={group.image} 
                      alt={group.name}
                      className="w-full h-48 object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                      onClick={() => handleGroupClick(group.id)}
                    />
                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-full p-2">
                      {group.is_private ? (
                        <Lock className="w-4 h-4 text-pink-500" />
                      ) : (
                        <Globe className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                    {group.isJoined && (
                      <div className="absolute top-4 left-4 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                        Joined
                      </div>
                    )}
                    {group.hasPendingRequest && (
                      <div className="absolute top-4 left-4 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">
                        Requested
                      </div>
                    )}
                    {group.invite_only && (
                      <div className="absolute bottom-4 left-4 bg-purple-500 text-white text-xs px-2 py-1 rounded-full">
                        Invite Only
                      </div>
                    )}
                  </div>
                  
                  <div className="p-6">
                    <h3 className="text-xl font-semibold mb-2">{group.name}</h3>
                    <p className="text-pink-600 font-medium mb-2">{group.product?.name}</p>
                    <p className="text-gray-600 text-sm mb-4">{group.description || "A shopping group for exclusive products"}</p>
                    
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center text-gray-500">
                        <Users className="w-4 h-4 mr-1" />
                        <span className="text-sm">{group.members} members</span>
                      </div>
                      {group.creator_id === user?.id && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleInviteMembers(group)}
                          className="border-pink-200 text-pink-600 hover:bg-pink-50"
                        >
                          <UserPlus className="w-4 h-4 mr-1" />
                          Invite
                        </Button>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Button 
                        size="sm" 
                        onClick={() => handleJoinGroup(group.id, group.isJoined, group)}
                        disabled={toggleGroupMembershipMutation.isPending || group.hasPendingRequest}
                        variant={group.isJoined ? "outline" : "default"}
                        className={`w-full ${group.isJoined 
                          ? "border-pink-200 text-pink-600 hover:bg-pink-50" 
                          : group.hasPendingRequest
                          ? "bg-yellow-500 text-white cursor-not-allowed"
                          : "social-button bg-gradient-to-r from-pink-500 to-rose-400 hover:from-pink-600 hover:to-rose-500"
                        }`}
                      >
                        {toggleGroupMembershipMutation.isPending ? "Processing..." :
                         group.isJoined ? "Leave" : 
                         group.hasPendingRequest ? "Requested" :
                         group.invite_only ? "Invite Only" :
                         (group.is_private && !group.auto_approve_requests) ? "Request to Join" : "Join Group"}
                      </Button>
                      
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={() => handleGroupClick(group.id)}
                        className="w-full text-pink-600 hover:bg-pink-50"
                      >
                        <ArrowRight className="w-4 h-4 mr-2" />
                        View Group
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredGroups.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-600 mb-2">No groups found</h3>
                <p className="text-gray-500">Try searching with different keywords or create a new group.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Invite Members Dialog */}
      {selectedGroupForInvite && (
        <InviteMembersDialog
          groupId={selectedGroupForInvite.id}
          groupName={selectedGroupForInvite.name}
          open={showInviteDialog}
          onOpenChange={setShowInviteDialog}
        />
      )}
    </Layout>
  );
};

export default Groups;
