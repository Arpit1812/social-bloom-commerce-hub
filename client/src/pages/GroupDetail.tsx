import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Users, Lock, ArrowLeft, ShoppingBag, UserPlus, Settings } from "lucide-react";
import Layout from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import JoinRequestsDialog from "@/components/JoinRequestsDialog";
import InviteMembersDialog from "@/components/InviteMembersDialog";

const GroupDetail = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showJoinRequests, setShowJoinRequests] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);

  console.log('GroupDetail: Component loading with groupId:', groupId, 'user:', user?.id);

  // Fetch group details with proper error handling and separate queries
  const { data: group, isLoading, error } = useQuery({
    queryKey: ['group', groupId],
    queryFn: async () => {
      console.log('GroupDetail: Fetching group details for:', groupId);
      
      if (!groupId) {
        throw new Error('Group ID is required');
      }
      
      // Get basic group data
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();
      
      console.log('GroupDetail: Basic group query result:', { groupData, groupError });
      
      if (groupError) {
        console.error('GroupDetail: Group query error:', groupError);
        throw groupError;
      }
      
      if (!groupData) {
        throw new Error('Group not found');
      }
      
      // Get related data in parallel
      const [creatorResult, productResult, membersResult, joinRequestsResult] = await Promise.allSettled([
        // Creator profile
        supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', groupData.creator_id)
          .single(),
        
        // Product details
        groupData.product_id ? supabase
          .from('products')
          .select('*')
          .eq('id', groupData.product_id)
          .single() : Promise.resolve({ data: null }),
        
        // Group members
        supabase
          .from('group_members')
          .select('user_id, joined_at')
          .eq('group_id', groupId),
        
        // User's join request status
        user?.id ? supabase
          .from('group_join_requests')
          .select('id, status, requested_at')
          .eq('group_id', groupId)
          .eq('user_id', user.id)
          .order('requested_at', { ascending: false })
          .limit(1) : Promise.resolve({ data: [] })
      ]);
      
      console.log('GroupDetail: Parallel queries results:', {
        creatorResult,
        productResult,
        membersResult,
        joinRequestsResult
      });
      
      let creatorProfile = null;
      let product = null;
      let members = [];
      let joinRequests = [];
      
      if (creatorResult.status === 'fulfilled' && creatorResult.value.data) {
        creatorProfile = creatorResult.value.data;
      }
      
      if (productResult.status === 'fulfilled' && productResult.value.data) {
        product = productResult.value.data;
      }
      
      if (membersResult.status === 'fulfilled' && membersResult.value.data) {
        members = membersResult.value.data;
      }
      
      if (joinRequestsResult.status === 'fulfilled' && joinRequestsResult.value.data) {
        joinRequests = joinRequestsResult.value.data;
      }
      
      // Get vendor profile if product exists
      let vendorProfile = null;
      if (product && product.vendor_id) {
        const { data: vendor } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', product.vendor_id)
          .single();
        vendorProfile = vendor;
      }
      
      // Get member profiles
      let memberProfiles = [];
      if (members.length > 0) {
        const memberIds = members.map(m => m.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .in('id', memberIds);
        
        memberProfiles = members.map(member => {
          const profile = profiles?.find(p => p.id === member.user_id);
          return {
            user_id: member.user_id,
            joined_at: member.joined_at,
            user_profile: profile
          };
        });
      }
      
      // Calculate user states
      const isJoined = members.some(member => member.user_id === user?.id);
      const latestJoinRequest = joinRequests.length > 0 ? joinRequests[0] : null;
      const hasPendingRequest = latestJoinRequest?.status === 'pending';
      
      console.log('GroupDetail: User state calculation:', {
        userId: user?.id,
        isJoined,
        hasPendingRequest,
        latestJoinRequest,
        membersCount: members.length
      });
      
      const result = {
        ...groupData,
        creator_profile: creatorProfile,
        product: product ? {
          ...product,
          vendor_profile: vendorProfile
        } : null,
        group_members: memberProfiles,
        isJoined,
        hasPendingRequest,
        members: memberProfiles,
        latestJoinRequest
      };
      
      console.log('GroupDetail: Final result:', result);
      return result;
    },
    enabled: !!user && !!groupId,
    staleTime: 0,
    refetchOnWindowFocus: true
  });

  // Add to cart mutation
  const addToCartMutation = useMutation({
    mutationFn: async (productId: string) => {
      if (!user) throw new Error('Not authenticated');
      
      const { error } = await supabase
        .from('cart_items')
        .upsert({
          user_id: user.id,
          product_id: productId,
          quantity: 1
        }, {
          onConflict: 'user_id,product_id'
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Added to Cart!",
        description: "Product has been added to your cart.",
      });
    },
    onError: (error) => {
      console.error('Error adding to cart:', error);
      toast({
        title: "Error",
        description: "Failed to add product to cart.",
        variant: "destructive"
      });
    }
  });

  // Enhanced join/leave group mutation with better cleanup
  const toggleGroupMembershipMutation = useMutation({
    mutationFn: async (isJoined: boolean) => {
      if (!user || !groupId || !group) {
        throw new Error('Missing required data');
      }
      
      console.log('=== GROUP DETAIL MUTATION START ===');
      console.log('Action:', isJoined ? 'LEAVING' : 'JOINING');
      console.log('Group:', groupId, 'User:', user.id);
      
      if (isJoined) {
        // LEAVING GROUP - Complete cleanup
        console.log('Leaving group - cleaning up all records');
        
        // Remove membership
        const { error: memberError } = await supabase
          .from('group_members')
          .delete()
          .eq('group_id', groupId)
          .eq('user_id', user.id);
        
        if (memberError) {
          console.error('Leave error:', memberError);
          throw memberError;
        }
        
        // Clean up any join requests
        await supabase
          .from('group_join_requests')
          .delete()
          .eq('group_id', groupId)
          .eq('user_id', user.id);
        
        console.log('Successfully left group');
        return { action: 'left' };
        
      } else {
        // JOINING GROUP
        if (group.invite_only) {
          throw new Error('This group is invite-only. Please ask for an invitation.');
        }
        
        if (group.hasPendingRequest) {
          throw new Error('You already have a pending request to join this group.');
        }
        
        // CRITICAL CLEANUP: Remove any existing records first
        console.log('CLEANUP: Removing any existing records');
        
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
        
        // Small delay to ensure cleanup
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const needsApproval = group.is_private && !group.auto_approve_requests;
        
        if (needsApproval) {
          console.log('Creating join request...');
          
          const { error: requestError } = await supabase
            .from('group_join_requests')
            .insert({
              group_id: groupId,
              user_id: user.id,
              status: 'pending'
            });
          
          if (requestError) {
            console.error('Request creation error:', requestError);
            throw requestError;
          }
          
          return { action: 'requested' };
        } else {
          console.log('Joining directly...');
          
          const { error: joinError } = await supabase
            .from('group_members')
            .insert({
              group_id: groupId,
              user_id: user.id
            });
          
          if (joinError) {
            console.error('Direct join error:', joinError);
            throw joinError;
          }
          
          return { action: 'joined' };
        }
      }
    },
    onSuccess: (result) => {
      console.log('Mutation success:', result);
      
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['group', groupId] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['join-requests', groupId] });
      
      // Show appropriate toast
      if (result?.action === 'requested') {
        toast({
          title: "Request Sent",
          description: `Your request to join ${group?.name} has been sent and is pending approval.`,
        });
      } else if (result?.action === 'left') {
        toast({
          title: "Left Group",
          description: `You left ${group?.name}`,
        });
      } else if (result?.action === 'joined') {
        toast({
          title: "Joined Group",
          description: `You joined ${group?.name}`,
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

  const handleJoinGroup = () => {
    console.log('Join button clicked:', {
      isJoined: group?.isJoined,
      hasPendingRequest: group?.hasPendingRequest,
      mutationPending: toggleGroupMembershipMutation.isPending
    });
    
    if (!group || toggleGroupMembershipMutation.isPending) {
      return;
    }
    
    toggleGroupMembershipMutation.mutate(group.isJoined);
  };

  const handleAddToCart = () => {
    if (group?.product) {
      addToCartMutation.mutate(group.product.id);
    }
  };

  const isCreator = group?.creator_id === user?.id;
  const canViewMembers = !group?.is_private || group?.isJoined || isCreator;
  const canViewProduct = !group?.is_private || group?.isJoined || isCreator;

  console.log('GroupDetail: Current render state:', {
    groupLoaded: !!group,
    isJoined: group?.isJoined,
    hasPendingRequest: group?.hasPendingRequest,
    inviteOnly: group?.invite_only,
    isCreator,
    mutationPending: toggleGroupMembershipMutation.isPending
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-b from-white to-pink-50">
          <div className="container mx-auto px-4 py-8">
            <div className="max-w-4xl mx-auto">
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-6"></div>
                <div className="h-64 bg-gray-200 rounded mb-6"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    console.error('GroupDetail: Error state:', error);
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-b from-white to-pink-50">
          <div className="container mx-auto px-4 py-8">
            <div className="max-w-4xl mx-auto text-center">
              <Button
                variant="ghost"
                onClick={() => navigate('/groups')}
                className="mb-6 text-pink-600 hover:bg-pink-50"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Groups
              </Button>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
                <h1 className="text-2xl font-bold mb-2 text-red-800">Error Loading Group</h1>
                <p className="text-red-600 mb-4">{error.message}</p>
                <p className="text-sm text-gray-600">Group ID: {groupId}</p>
              </div>
              
              <Button onClick={() => navigate('/groups')}>
                Back to Groups
              </Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!group) {
    return (
      <Layout>
        <div className="min-h-screen bg-gradient-to-b from-white to-pink-50">
          <div className="container mx-auto px-4 py-8">
            <div className="max-w-4xl mx-auto text-center">
              <Button
                variant="ghost"
                onClick={() => navigate('/groups')}
                className="mb-6 text-pink-600 hover:bg-pink-50"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Groups
              </Button>
              
              <h1 className="text-2xl font-bold mb-4">Group not found</h1>
              <p className="text-gray-600 mb-4">The group you're looking for doesn't exist or has been removed.</p>
              <p className="text-sm text-gray-500 mb-6">Group ID: {groupId}</p>
              
              <Button onClick={() => navigate('/groups')}>
                Back to Groups
              </Button>
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
          <div className="max-w-4xl mx-auto">
            {/* Back Button */}
            <Button
              variant="ghost"
              onClick={() => navigate('/groups')}
              className="mb-6 text-pink-600 hover:bg-pink-50"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Groups
            </Button>



            {/* Group Header */}
            <div className="smooth-card p-6 mb-8">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="md:w-1/2">
                  <img 
                    src={group.product?.image_url || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=500&h=300&fit=crop"} 
                    alt={group.name}
                    className="w-full h-64 object-cover rounded-lg"
                  />
                </div>
                <div className="md:w-1/2">
                  <div className="flex items-center gap-2 mb-2">
                    {group.is_private && (
                      <>
                        <Lock className="w-5 h-5 text-pink-500" />
                        <span className="text-sm text-gray-500">Private Group</span>
                      </>
                    )}
                    {group.invite_only && (
                      <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded-full">
                        Invite Only
                      </span>
                    )}
                    {group.isJoined && (
                      <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                        Joined
                      </span>
                    )}
                    {group.hasPendingRequest && (
                      <span className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">
                        Requested
                      </span>
                    )}
                  </div>
                  <h1 className="text-3xl font-bold mb-4">{group.name}</h1>
                  <p className="text-gray-600 mb-4">{group.description || "A shopping group for exclusive products"}</p>
                  
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex items-center text-gray-500">
                      <Users className="w-5 h-5 mr-2" />
                      <span>{group.members.length} members</span>
                    </div>
                    {isCreator && (
                      <p className="text-sm text-pink-600 font-medium">You created this group</p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {/* Show appropriate button based on state */}
                    {!group.isJoined && !group.invite_only && !group.hasPendingRequest && (
                      <Button 
                        onClick={handleJoinGroup}
                        disabled={toggleGroupMembershipMutation.isPending}
                        className="social-button bg-gradient-to-r from-pink-500 to-rose-400 hover:from-pink-600 hover:to-rose-500"
                      >
                        {toggleGroupMembershipMutation.isPending ? "Processing..." : (group.is_private && !group.auto_approve_requests ? "Request to Join" : "Join Group")}
                      </Button>
                    )}
                    
                    {group.hasPendingRequest && (
                      <Button 
                        disabled
                        className="bg-yellow-500 text-white cursor-not-allowed opacity-75"
                      >
                        Request Pending
                      </Button>
                    )}
                    
                    {group.isJoined && !isCreator && (
                      <Button 
                        onClick={handleJoinGroup}
                        disabled={toggleGroupMembershipMutation.isPending}
                        variant="outline"
                        className="border-pink-200 text-pink-600 hover:bg-pink-50"
                      >
                        {toggleGroupMembershipMutation.isPending ? "Leaving..." : "Leave Group"}
                      </Button>
                    )}

                    {group.invite_only && !group.isJoined && !isCreator && !group.hasPendingRequest && (
                      <div className="text-center">
                        <p className="text-gray-600 mb-2">This is an invite-only group</p>
                        <p className="text-sm text-gray-500">Contact the group creator for an invitation</p>
                      </div>
                    )}

                    {isCreator && (
                      <>
                        <Button 
                          onClick={() => setShowInviteDialog(true)}
                          variant="outline"
                          className="border-pink-200 text-pink-600 hover:bg-pink-50"
                        >
                          <UserPlus className="w-4 h-4 mr-2" />
                          Invite Members
                        </Button>
                        <Button 
                          onClick={() => setShowJoinRequests(true)}
                          variant="outline"
                          className="border-pink-200 text-pink-600 hover:bg-pink-50"
                        >
                          <Settings className="w-4 h-4 mr-2" />
                          Manage Requests
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tiered Discount Progress and Sharing Section */}
            {canViewProduct && group.product && (
              <div className="smooth-card p-6 mb-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left Side - Discount Progress */}
                  <div>
                    <h3 className="text-xl font-semibold mb-4 text-pink-600">Group Discount Progress</h3>
                    
                    {/* Current Status */}
                    <div className="bg-gradient-to-r from-pink-50 to-rose-50 p-4 rounded-lg border border-pink-200 mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Current Members: {group.members.length}</span>
                        <span className="text-lg font-bold text-pink-600">
                          {group.members.length >= 4 ? '20% OFF' : 
                           group.members.length >= 3 ? '15% OFF' : 
                           group.members.length >= 2 ? '10% OFF' : 'No discount yet'}
                        </span>
                      </div>
                      {group.members.length >= 2 && (
                        <div className="text-sm text-gray-600">
                          Everyone saves ${((group.product.price * (group.members.length >= 4 ? 0.2 : group.members.length >= 3 ? 0.15 : 0.1))).toFixed(2)} per item!
                        </div>
                      )}
                    </div>

                    {/* Discount Tiers Progress */}
                    <div className="space-y-3">
                      <div className={`flex items-center justify-between p-3 rounded-lg border ${group.members.length >= 2 ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full ${group.members.length >= 2 ? 'bg-green-500' : 'bg-gray-300'} flex items-center justify-center`}>
                            {group.members.length >= 2 && <span className="text-white text-xs">✓</span>}
                          </div>
                          <span className="font-medium">2 Members - 10% OFF</span>
                        </div>
                        <span className="font-bold text-pink-600">${(group.product.price * 0.9).toFixed(2)}</span>
                      </div>
                      
                      <div className={`flex items-center justify-between p-3 rounded-lg border ${group.members.length >= 3 ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full ${group.members.length >= 3 ? 'bg-green-500' : 'bg-gray-300'} flex items-center justify-center`}>
                            {group.members.length >= 3 && <span className="text-white text-xs">✓</span>}
                          </div>
                          <span className="font-medium">3 Members - 15% OFF</span>
                        </div>
                        <span className="font-bold text-pink-600">${(group.product.price * 0.85).toFixed(2)}</span>
                      </div>
                      
                      <div className={`flex items-center justify-between p-3 rounded-lg border ${group.members.length >= 4 ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full ${group.members.length >= 4 ? 'bg-green-500' : 'bg-gray-300'} flex items-center justify-center`}>
                            {group.members.length >= 4 && <span className="text-white text-xs">✓</span>}
                          </div>
                          <span className="font-medium">4+ Members - 20% OFF</span>
                        </div>
                        <span className="font-bold text-pink-600">${(group.product.price * 0.8).toFixed(2)}</span>
                      </div>
                    </div>

                    {group.members.length < 4 && (
                      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-700">
                          Invite {4 - group.members.length} more {group.members.length === 3 ? 'person' : 'people'} to unlock maximum savings!
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right Side - Sharing Options */}
                  <div>
                    <h3 className="text-xl font-semibold mb-4 text-pink-600">Share This Group</h3>
                    
                    {/* Group Link */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2">Group Link</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={`${window.location.origin}/groups/${groupId}`}
                          readOnly
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm"
                        />
                        <Button
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/groups/${groupId}`);
                            toast({ title: "Link copied to clipboard!" });
                          }}
                          variant="outline"
                          size="sm"
                        >
                          Copy
                        </Button>
                      </div>
                    </div>

                    {/* QR Code */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2">QR Code</label>
                      <div className="flex items-center justify-center bg-white p-4 border rounded-lg">
                        <div className="w-32 h-32 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                          <div className="text-center">
                            <div className="text-xs text-gray-500 mb-1">QR Code</div>
                            <div className="text-xs text-gray-400">Scan to join</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* WhatsApp Share */}
                    <div className="space-y-2">
                      <Button
                        onClick={() => {
                          const message = `Hey! Join my shopping group "${group.name}" and get up to 20% OFF on ${group.product.name}! 🛍️\n\nWe currently have ${group.members.length} members${group.members.length >= 2 ? ` and everyone is already saving ${group.members.length >= 4 ? '20%' : group.members.length >= 3 ? '15%' : '10%'}!` : ', but we need at least 2 people to unlock discounts.'}\n\nJoin here: ${window.location.origin}/groups/${groupId}`;
                          window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
                        }}
                        className="w-full bg-green-500 hover:bg-green-600 text-white"
                      >
                        📱 Share on WhatsApp
                      </Button>
                      
                      <Button
                        onClick={() => {
                          const message = `Join my shopping group "${group.name}" for up to 20% OFF! ${window.location.origin}/groups/${groupId}`;
                          if (navigator.share) {
                            navigator.share({
                              title: group.name,
                              text: message,
                              url: `${window.location.origin}/groups/${groupId}`
                            });
                          } else {
                            navigator.clipboard.writeText(message);
                            toast({ title: "Message copied to clipboard!" });
                          }
                        }}
                        variant="outline"
                        className="w-full"
                      >
                        📤 Share with Friends
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Product Section */}
            {canViewProduct && group.product && (
              <div className="smooth-card p-6 mb-8">
                <h2 className="text-2xl font-semibold mb-4">Featured Product</h2>
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="md:w-1/3">
                    <img 
                      src={group.product.image_url || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=300&h=300&fit=crop"} 
                      alt={group.product.name}
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  </div>
                  <div className="md:w-2/3">
                    <h3 className="text-xl font-semibold mb-2">{group.product.name}</h3>
                    <p className="text-gray-600 mb-4">{group.product.description}</p>
                    <p className="text-2xl font-bold text-pink-600 mb-4">${group.product.price}</p>
                    <p className="text-sm text-gray-500 mb-4">
                      By {group.product.vendor_profile?.full_name || group.product.vendor_profile?.email || 'Unknown Vendor'}
                    </p>
                    
                    {group.isJoined && (
                      <Button 
                        onClick={handleAddToCart}
                        disabled={addToCartMutation.isPending}
                        className="social-button bg-gradient-to-r from-pink-500 to-rose-400 hover:from-pink-600 hover:to-rose-500"
                      >
                        <ShoppingBag className="w-4 h-4 mr-2" />
                        {addToCartMutation.isPending ? 'Adding...' : 'Add to Cart'}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!canViewProduct && (
              <div className="smooth-card p-6 mb-8 text-center">
                <Lock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-600 mb-2">Private Group Content</h3>
                <p className="text-gray-500">Join the group to see the featured product and other exclusive content.</p>
              </div>
            )}

            {/* Members Section */}
            <div className="smooth-card p-6">
              <h2 className="text-2xl font-semibold mb-4">
                Members ({canViewMembers ? group.members.length : '?'})
              </h2>
              
              {canViewMembers ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {group.members.map((member) => (
                    <div key={member.user_id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={member.user_profile?.avatar_url} />
                        <AvatarFallback>
                          {member.user_profile?.full_name?.charAt(0) || member.user_profile?.email?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">
                          {member.user_profile?.full_name || member.user_profile?.email?.split('@')[0] || 'User'}
                          {member.user_id === group.creator_id && (
                            <span className="ml-2 text-xs bg-pink-100 text-pink-800 px-2 py-1 rounded-full">
                              Creator
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-gray-500">
                          Joined {new Date(member.joined_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Lock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Member list is private. Join the group to see who's in it!</p>
                </div>
              )}
              
              {canViewMembers && group.members.length === 0 && (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No members yet. Be the first to join!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dialogs */}
      {isCreator && (
        <>
          <JoinRequestsDialog
            groupId={groupId!}
            groupName={group.name}
            open={showJoinRequests}
            onOpenChange={setShowJoinRequests}
          />
          <InviteMembersDialog
            groupId={groupId!}
            groupName={group.name}
            open={showInviteDialog}
            onOpenChange={setShowInviteDialog}
          />
        </>
      )}
    </Layout>
  );
};

export default GroupDetail;
