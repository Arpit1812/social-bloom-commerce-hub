
import { Button } from "@/components/ui/button";
import { Users, Package } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const GroupsPreview = () => {
  const navigate = useNavigate();

  // Fetch groups from database with simpler approach
  const { data: groups = [], isLoading, error } = useQuery({
    queryKey: ['groups-preview'],
    queryFn: async () => {
      try {
        // Get basic group data with a simple query
        const { data: groupsData, error: groupsError } = await supabase
          .from('groups')
          .select('*')
          .limit(3);
        
        if (groupsError) {
          throw groupsError;
        }

        if (!groupsData || groupsData.length === 0) {
          return [];
        }

        // Get all unique creator IDs and product IDs
        const creatorIds = [...new Set(groupsData.map(g => g.creator_id))];
        const productIds = [...new Set(groupsData.map(g => g.product_id).filter(Boolean))];
        
        // Get creators in parallel
        const creatorsPromise = creatorIds.length > 0 
          ? supabase.from('profiles').select('id, full_name, email').in('id', creatorIds)
          : Promise.resolve({ data: [], error: null });
        
        // Get products in parallel  
        const productsPromise = productIds.length > 0
          ? supabase.from('products').select('id, name, image_url').in('id', productIds)
          : Promise.resolve({ data: [], error: null });
        
        // Get group members count in parallel
        const groupIds = groupsData.map(g => g.id);
        const membersPromise = groupIds.length > 0
          ? supabase.from('group_members').select('group_id').in('group_id', groupIds)
          : Promise.resolve({ data: [], error: null });
        
        const [creatorsResult, productsResult, membersResult] = await Promise.all([
          creatorsPromise,
          productsPromise, 
          membersPromise
        ]);
        
        console.log('GroupsPreview: Parallel queries results:', { 
          creators: creatorsResult, 
          products: productsResult, 
          members: membersResult 
        });
        
        const creators = creatorsResult.data || [];
        const products = productsResult.data || [];
        const membersData = membersResult.data || [];
        
        // Count members per group
        const memberCounts = membersData.reduce((acc: any, member: any) => {
          acc[member.group_id] = (acc[member.group_id] || 0) + 1;
          return acc;
        }, {});
        
        // Combine all data
        const processedGroups = groupsData.map(group => {
          const creator = creators.find(c => c.id === group.creator_id);
          const product = products.find(p => p.id === group.product_id);
          const memberCount = memberCounts[group.id] || 0;
          
          return {
            id: group.id,
            name: group.name,
            description: group.description || 'A great shopping group',
            members: memberCount,
            image: product?.image_url || `https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400&h=300&fit=crop`,
            productName: product?.name || 'Product',
            creatorName: creator?.full_name || creator?.email?.split('@')[0] || 'User'
          };
        });
        
        console.log('GroupsPreview: Final processed groups:', processedGroups);
        return processedGroups;
        
      } catch (error) {
        console.error('GroupsPreview: Error in query function:', error);
        throw error;
      }
    },
  });

  const handleGroupClick = (groupId: string) => {
    console.log('GroupsPreview: Navigating to group:', groupId);
    navigate(`/groups/${groupId}`);
  };

  console.log('GroupsPreview: Component render state:', { 
    groupsCount: groups.length, 
    isLoading, 
    error: error?.message 
  });

  if (isLoading) {
    return (
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Active Groups</h2>
              <p className="text-xl text-gray-600">Join groups and share experiences</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="smooth-card animate-pulse">
                  <div className="h-48 bg-gray-200 rounded mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Active Groups</h2>
              <p className="text-xl text-gray-600">Join groups and share experiences</p>
            </div>
            
            <div className="text-center py-12">
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-4">
                <h3 className="text-lg font-semibold text-red-800 mb-2">Error loading groups</h3>
                <p className="text-red-600">{error.message}</p>
              </div>
              <Button 
                onClick={() => window.location.reload()}
                className="social-button bg-gradient-to-r from-pink-500 to-rose-400 hover:from-pink-600 hover:to-rose-500"
              >
                Retry
              </Button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // If no groups, show fallback message
  if (groups.length === 0) {
    return (
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Active Groups</h2>
              <p className="text-xl text-gray-600">Join groups and share experiences</p>
            </div>
            
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No groups yet</h3>
              <p className="text-gray-500">Be the first to create a group and start building community!</p>
              <Button 
                onClick={() => navigate('/groups')}
                className="mt-4 social-button bg-gradient-to-r from-pink-500 to-rose-400 hover:from-pink-600 hover:to-rose-500"
              >
                Create First Group
              </Button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-20 bg-white">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Active Groups</h2>
            <p className="text-xl text-gray-600">Join groups and share experiences</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {groups.map((group) => (
              <div 
                key={group.id} 
                className="smooth-card overflow-hidden floating-card animate-fade-in cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => handleGroupClick(group.id)}
              >
                <div className="relative">
                  <img 
                    src={group.image} 
                    alt={group.name}
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute top-4 left-4">
                    <span className="bg-white/90 text-pink-600 px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm">
                      <Package className="w-4 h-4 inline mr-1" />
                      {group.productName}
                    </span>
                  </div>
                </div>
                
                <div className="p-6">
                  <h3 className="text-xl font-semibold mb-2">{group.name}</h3>
                  <p className="text-gray-600 mb-4 line-clamp-2">{group.description}</p>
                  
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center text-pink-600">
                      <Users className="w-5 h-5 mr-2" />
                      <span className="font-medium">{group.members} members</span>
                    </div>
                    <span className="text-sm text-gray-500">by {group.creatorName}</span>
                  </div>
                  
                  <Button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGroupClick(group.id);
                    }}
                    className="w-full social-button bg-gradient-to-r from-pink-500 to-rose-400 hover:from-pink-600 hover:to-rose-500"
                  >
                    View Group
                  </Button>
                </div>
              </div>
            ))}
          </div>
          
          <div className="text-center mt-12">
            <Button 
              onClick={() => navigate('/groups')}
              className="social-button bg-gradient-to-r from-pink-500 to-rose-400 hover:from-pink-600 hover:to-rose-500"
            >
              View All Groups
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default GroupsPreview;
