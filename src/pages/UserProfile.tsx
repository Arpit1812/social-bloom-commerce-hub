import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  User, Package, FileText, BarChart3, Settings, AlertCircle, CheckCircle, 
  Clock, Heart, MessageCircle, Share2, Plus, Edit, Camera, Shield, 
  Users, ShoppingCart, Calendar, Building, Mail, Phone, MapPin, Menu, X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import KYCForm from "@/components/KYCForm";
import ProductForm from "@/components/ProductForm";
import VendorProductCard from "@/components/VendorProductCard";
import ImportProductsModal from "@/components/ImportProductsModal";
import { cn } from "@/lib/utils";

const UserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user, profile: currentUserProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState('posts');
  const [editingProfile, setEditingProfile] = useState(false);
  const [showKYCForm, setShowKYCForm] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
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

  const isVendor = profile?.role === 'vendor';
  const isCurrentUserVendor = currentUserProfile?.role === 'vendor';

  // Initialize form when profile loads
  useEffect(() => {
    if (profile) {
      setProfileForm({
        full_name: profile.full_name || '',
        bio: profile.bio || '',
        website: profile.website || '',
        location: profile.location || '',
        avatar_url: profile.avatar_url || '',
      });
    }
  }, [profile]);

  // Clear vendor-only data from cart/wishlist if user becomes vendor
  useEffect(() => {
    if (isCurrentUserVendor && isOwnProfile) {
      const clearVendorData = async () => {
        try {
          await supabase.from('cart_items').delete().eq('user_id', user?.id);
          await supabase.from('wishlist').delete().eq('user_id', user?.id);
        } catch (error) {
          console.error('Error clearing vendor data:', error);
        }
      };
      clearVendorData();
    }
  }, [isCurrentUserVendor, isOwnProfile, user?.id]);

  // Close mobile menu when section changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [activeSection]);

  // Fetch KYC data for vendors
  const { data: kycData } = useQuery({
    queryKey: ['kyc', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vendor_kyc')
        .select('*')
        .eq('vendor_id', profile?.id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!profile?.id && isVendor,
  });

  // Fetch vendor stats
  const { data: vendorStats } = useQuery({
    queryKey: ['vendor-stats', profile?.id],
    queryFn: async () => {
      if (!isVendor) return null;

      // Total products
      const { count: totalProducts } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('vendor_id', profile?.id);

      // Active products
      const { count: activeProducts } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('vendor_id', profile?.id)
        .eq('is_active', true);

      // Products sold (from order_items via products)
      const { data: soldProductsData } = await supabase
        .from('order_items')
        .select(`
          quantity,
          price,
          orders!inner(created_at),
          products!inner(vendor_id)
        `)
        .eq('products.vendor_id', profile?.id);

      const totalSold = soldProductsData?.reduce((sum, item) => sum + item.quantity, 0) || 0;
      const totalRevenue = soldProductsData?.reduce((sum, item) => sum + (item.quantity * item.price), 0) || 0;

      // Sales last month
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      
      const lastMonthSales = soldProductsData?.filter(item => 
        new Date(item.orders.created_at) >= lastMonth
      ).reduce((sum, item) => sum + (item.quantity * item.price), 0) || 0;

      return {
        totalProducts: totalProducts || 0,
        activeProducts: activeProducts || 0,
        totalSold,
        totalRevenue,
        lastMonthSales
      };
    },
    enabled: !!profile?.id && isVendor,
  });

  // Fetch user's posts
  const { data: posts = [] } = useQuery({
    queryKey: ['user-posts', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  // Fetch vendor's products
  const { data: products = [] } = useQuery({
    queryKey: ['vendor-products', profile?.id],
    queryFn: async () => {
      if (!isVendor) return [];
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('vendor_id', profile?.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id && isVendor,
  });

  // Fetch user's groups
  const { data: userGroups = [] } = useQuery({
    queryKey: ['user-groups', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      
      const { data, error } = await supabase
        .from('group_members')
        .select(`
          groups (
            id,
            name,
            description,
            is_private,
            created_at,
            products (
              name,
              image_url
            )
          )
        `)
        .eq('user_id', profile.id);
      
      if (error) throw error;
      return data.map(item => item.groups).filter(Boolean);
    },
    enabled: !!profile?.id,
  });

  // Fetch user's orders (only for own profile and non-vendors)
  const { data: orders = [] } = useQuery({
    queryKey: ['user-orders', profile?.id],
    queryFn: async () => {
      if (!profile?.id || isVendor || !isOwnProfile) return [];
      
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            *,
            products (
              name,
              image_url
            )
          )
        `)
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id && !isVendor && isOwnProfile,
  });

  // Fetch user's cart (only for own profile and non-vendors)
  const { data: cartItems = [] } = useQuery({
    queryKey: ['user-cart', profile?.id],
    queryFn: async () => {
      if (!profile?.id || isVendor || !isOwnProfile) return [];
      
      const { data, error } = await supabase
        .from('cart_items')
        .select(`
          *,
          products (
            name,
            image_url,
            price
          )
        `)
        .eq('user_id', profile.id);
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id && !isVendor && isOwnProfile,
  });

  // Calculate profile stats
  const followersCount = 0; // TODO: implement when follows table is ready
  const followingCount = 0; // TODO: implement when follows table is ready

  // Sidebar navigation items
  const getUserNavItems = () => [
    { id: 'posts', label: 'Posts', icon: FileText },
    { id: 'groups', label: 'Groups', icon: Users },
    ...(isOwnProfile ? [
      { id: 'orders', label: 'Orders', icon: ShoppingCart },
      { id: 'cart', label: 'Cart', icon: ShoppingCart },
    ] : [])
  ];

  const getVendorNavItems = () => [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'products', label: 'Products', icon: Package },
    { id: 'posts', label: 'Posts', icon: FileText },
    { id: 'groups', label: 'Groups', icon: Users },
    ...(isOwnProfile ? [
      { id: 'kyc', label: 'KYC Status', icon: Shield },
      { id: 'company', label: 'Company Info', icon: Building },
    ] : [])
  ];

  const navItems = isVendor ? getVendorNavItems() : getUserNavItems();

  // Profile update mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (updatedData: any) => {
      const { error } = await supabase
        .from('profiles')
        .update(updatedData)
        .eq('id', profile?.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Profile updated successfully!" });
      setEditingProfile(false);
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error updating profile", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const handleProfileUpdate = () => {
    updateProfileMutation.mutate(profileForm);
  };

  // KYC status banner (only for own vendor profile when not approved)
  const KYCStatusBanner = () => {
    if (!isVendor || !isOwnProfile) return null;

    if (!kycData) {
    return (
        <Alert className="mb-6 border-orange-200 bg-orange-50">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span>Please complete your KYC verification to start selling products.</span>
              <Button 
                onClick={() => setShowKYCForm(true)}
                size="sm"
                className="self-start sm:self-auto"
              >
                Complete KYC
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      );
    }

    if (kycData.status === 'pending') {
      return (
        <Alert className="mb-6 border-blue-200 bg-blue-50">
          <Clock className="h-4 w-4" />
          <AlertDescription>
            Your KYC verification is pending approval. We'll notify you once it's processed.
          </AlertDescription>
        </Alert>
      );
    }

    return null;
  };

  // Render different sections
  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vendorStats?.totalProducts || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active Products</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{vendorStats?.activeProducts || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Sold</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vendorStats?.totalSold || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{vendorStats?.totalRevenue || 0}</div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Last Month Sales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-pink-600">₹{vendorStats?.lastMonthSales || 0}</div>
        </CardContent>
      </Card>
    </div>
  );

  const renderPosts = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Posts</h3>
        {isOwnProfile && (
          <Button onClick={() => navigate('/feed')}>
            <Plus className="w-4 h-4 mr-2" />
            Create Post
          </Button>
        )}
      </div>
      {posts.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-500">No posts yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <Card key={post.id}>
              <CardContent className="p-4">
                <p>{post.content}</p>
                <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Heart className="w-4 h-4" />
                    0
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="w-4 h-4" />
                    0
                  </span>
                  <span>{new Date(post.created_at).toLocaleDateString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderProducts = () => {
    const isKYCApproved = kycData?.status === 'approved';
    const isKYCPending = kycData?.status === 'pending';
    const isKYCRejected = kycData?.status === 'rejected';
    const hasNoKYC = !kycData;

    // Helper function to render KYC status banner
    const renderKYCBanner = () => {
      if (hasNoKYC || isKYCRejected) {
        return (
          <Alert className="mb-6 border-orange-200 bg-orange-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span>Complete your KYC verification to start selling products on the marketplace.</span>
                <Button 
                  onClick={() => setShowKYCForm(true)}
                  size="sm"
                  className="self-start sm:self-auto"
                >
                  {hasNoKYC ? 'Initiate KYC' : 'Resubmit KYC'}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        );
      }

      if (isKYCPending) {
        return (
          <Alert className="mb-6 border-blue-200 bg-blue-50">
            <Clock className="h-4 w-4" />
            <AlertDescription>
              Your KYC verification is pending approval. You'll be able to add products once approved.
            </AlertDescription>
          </Alert>
        );
      }

      return null;
    };

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Products</h3>
          {isOwnProfile && isKYCApproved && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Import
              </Button>
              <Button onClick={() => setShowProductForm(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Button>
            </div>
          )}
        </div>

        {/* Show KYC banner for own profile if KYC not approved */}
        {isOwnProfile && !isKYCApproved && renderKYCBanner()}

        {/* Only show product content if KYC is approved or viewing someone else's profile */}
        {(isKYCApproved || !isOwnProfile) && (
          <>
            {products.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <Package className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">No products yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product, index) => (
                  <VendorProductCard
                    key={product.id}
                    product={product}
                    isOwner={isOwnProfile}
                    index={index}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  const renderGroups = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Groups</h3>
      {userGroups.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <Users className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">Not in any groups yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {userGroups.map((group) => (
            <Card key={group.id} className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/groups/${group.id}`)}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-2">
                  <img 
                    src={group.products?.image_url || '/placeholder.svg'} 
                    alt={group.products?.name}
                    className="w-10 h-10 rounded object-cover"
                  />
                  <div>
                    <h4 className="font-semibold">{group.name}</h4>
                    <p className="text-sm text-gray-600">{group.products?.name}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2">{group.description}</p>
                <div className="flex items-center justify-between mt-3 text-sm">
                  <Badge variant={group.is_private ? "secondary" : "default"}>
                    {group.is_private ? 'Private' : 'Public'}
                  </Badge>
                  <span className="text-gray-500">
                    {new Date(group.created_at).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderOrders = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Order History</h3>
      {orders.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <ShoppingCart className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No orders yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3 gap-2">
                  <div>
                    <h4 className="font-medium">Order #{order.id.slice(0, 8)}</h4>
                    <p className="text-sm text-gray-600">Status: {order.status}</p>
                    <p className="text-sm text-gray-600">
                      Date: {new Date(order.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="text-lg font-semibold">₹{order.total_amount}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {order.order_items?.map((item: any) => (
                    <div key={item.id} className="flex items-center gap-2 bg-gray-50 rounded p-2">
                      <img 
                        src={item.products?.image_url || '/placeholder.svg'}
                        alt={item.products?.name}
                        className="w-8 h-8 rounded object-cover"
                      />
                      <span className="text-sm">{item.products?.name} x{item.quantity}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderCart = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Shopping Cart</h3>
      {cartItems.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <ShoppingCart className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">Cart is empty.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {cartItems.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <img 
                    src={item.products?.image_url || '/placeholder.svg'}
                    alt={item.products?.name}
                    className="w-16 h-16 rounded object-cover"
                  />
                  <div className="flex-1">
                    <h4 className="font-semibold">{item.products?.name}</h4>
                    <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                    <p className="text-lg font-bold">₹{item.products?.price}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderKYCStatus = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">KYC Verification Status</h3>
      {!kycData ? (
        <Card>
          <CardContent className="text-center py-8">
            <AlertCircle className="w-12 h-12 mx-auto text-orange-400 mb-4" />
            <h4 className="font-semibold mb-2">KYC Not Completed</h4>
            <p className="text-gray-600 mb-4">Complete your KYC verification to start selling</p>
            <Button onClick={() => setShowKYCForm(true)}>Complete KYC</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              {kycData.status === 'approved' ? (
                <CheckCircle className="w-8 h-8 text-green-500" />
              ) : kycData.status === 'pending' ? (
                <Clock className="w-8 h-8 text-blue-500" />
              ) : (
                <AlertCircle className="w-8 h-8 text-red-500" />
              )}
              <div>
                <h4 className="font-semibold">
                  {kycData.status === 'approved' ? 'Verified' : 
                   kycData.status === 'pending' ? 'Pending' : 'Rejected'}
                </h4>
                <p className="text-sm text-gray-600">
                  Business Name: {kycData.business_name}
                </p>
              </div>
            </div>
            {kycData.status === 'rejected' && (
              <div className="mt-4">
                <p className="text-sm text-red-600 mb-4">
                  Your KYC was rejected. Please resubmit with correct information.
                </p>
                <Button onClick={() => setShowKYCForm(true)} variant="outline">
                  Resubmit KYC
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );

  const renderCompanyInfo = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Company Information</h3>
      {!kycData ? (
        <Card>
          <CardContent className="text-center py-8">
            <Building className="w-12 h-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">Complete KYC to view company information.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-600">Business Name</Label>
                <p className="font-semibold">{kycData.business_name}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Display Name</Label>
                <p className="font-semibold">{kycData.display_business_name}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Business Type</Label>
                <p className="font-semibold">{kycData.business_type}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Registration Number</Label>
                <p className="font-semibold">{kycData.business_registration_number}</p>
              </div>
              <div className="sm:col-span-2">
                <Label className="text-sm font-medium text-gray-600">Business Address</Label>
                <p className="font-semibold">{kycData.business_address}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Contact Email</Label>
                <p className="font-semibold">{kycData.contact_email}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Contact Phone</Label>
                <p className="font-semibold">{kycData.contact_phone}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
          </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return renderOverview();
      case 'posts':
        return renderPosts();
      case 'products':
        return renderProducts();
      case 'groups':
        return renderGroups();
      case 'orders':
        return renderOrders();
      case 'cart':
        return renderCart();
      case 'kyc':
        return renderKYCStatus();
      case 'company':
        return renderCompanyInfo();
      default:
        return renderPosts();
    }
  };

  if (!profileUserId) {
    navigate('/auth');
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">User not found</h1>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      
      {/* Main Content Container */}
      <div className="flex-1 container mx-auto px-2 sm:px-4 py-4 sm:py-8 mt-20">
        <KYCStatusBanner />
        
        {/* Profile Header */}
        <Card className="mb-6 sm:mb-8">
          <CardContent className="p-4 sm:p-6">
            {/* Main Profile Info */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
              <Avatar className="w-24 h-24 sm:w-32 sm:h-32 mx-auto sm:mx-0">
                <AvatarImage src={profile.avatar_url} />
                <AvatarFallback className="text-2xl sm:text-4xl">
                  {profile.full_name?.[0] || profile.email[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 space-y-3 sm:space-y-4 text-center sm:text-left">
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2">
                    <h1 className="text-2xl sm:text-3xl font-bold">{profile.full_name || profile.email}</h1>
                    {isVendor && kycData?.status === 'approved' && (
                      <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-green-500 mx-auto sm:mx-0" />
                    )}
                  </div>
                  <p className="text-gray-600">@{profile.email.split('@')[0]}</p>
                  <Badge variant="outline" className="mt-2 capitalize">
                    {profile.role}
                  </Badge>
                </div>
                
                {/* Stats */}
                <div className="flex justify-center sm:justify-start gap-6 sm:gap-8">
                  <div className="text-center">
                    <div className="text-lg sm:text-xl font-bold">{posts.length}</div>
                    <div className="text-xs sm:text-sm text-gray-600">Posts</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg sm:text-xl font-bold">{followersCount}</div>
                    <div className="text-xs sm:text-sm text-gray-600">Followers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg sm:text-xl font-bold">{followingCount}</div>
                    <div className="text-xs sm:text-sm text-gray-600">Following</div>
                  </div>
                </div>
                
                {/* Bio */}
                {profile.bio && (
                  <p className="text-gray-800">{profile.bio}</p>
                )}
                
                {/* Additional Info */}
                <div className="flex flex-wrap justify-center sm:justify-start gap-3 sm:gap-4 text-xs sm:text-sm text-gray-600">
                  {profile.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 sm:w-4 sm:h-4" />
                      {profile.location}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 sm:w-4 sm:h-4" />
                    Joined {new Date(profile.created_at).toLocaleDateString('en-US', { 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </span>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-2 w-full sm:w-auto">
                {isOwnProfile ? (
                  <Button onClick={() => setEditingProfile(true)} className="flex-1 sm:flex-none">
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Profile
                  </Button>
                ) : (
                  <Button variant="outline" className="flex-1 sm:flex-none">
                    Follow
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content with Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-8 min-h-[600px]">
          {/* Mobile Navigation Toggle */}
          <div className="lg:hidden mb-4">
            <Button 
              variant="outline" 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="w-full flex items-center justify-between"
            >
              <span>Navigation</span>
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </Button>
          </div>

          {/* Sidebar */}
          <div className={cn(
            "lg:col-span-1",
            mobileMenuOpen ? "block" : "hidden lg:block"
          )}>
            <Card className="h-full lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)]">
              <CardContent className="p-3 sm:p-4 h-full flex flex-col">
                <nav className="space-y-1 sm:space-y-2">
                  {navItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      className={cn(
                        "w-full flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-lg text-left transition-colors text-sm sm:text-base",
                        activeSection === item.id
                          ? "bg-pink-100 text-pink-700"
                          : "hover:bg-gray-100"
                      )}
                    >
                      <item.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                      {item.label}
                    </button>
                  ))}
                </nav>
                {/* Spacer to fill remaining height */}
                <div className="flex-1"></div>
              </CardContent>
            </Card>
          </div>

          {/* Content Area */}
          <div className="lg:col-span-3 min-h-[500px]">
            <div className="space-y-6">
              {renderContent()}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Dialog */}
      {editingProfile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Edit Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  value={profileForm.full_name}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, full_name: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="bio">Bio</Label>
                <Input
                  id="bio"
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, bio: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={profileForm.location}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, location: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={profileForm.website}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, website: e.target.value }))}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleProfileUpdate} className="flex-1">Save Changes</Button>
                <Button variant="outline" onClick={() => setEditingProfile(false)} className="flex-1">Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Dialogs */}
      {showKYCForm && (
        <KYCForm 
          onClose={() => setShowKYCForm(false)}
          onSuccess={() => {
            setShowKYCForm(false);
            queryClient.invalidateQueries({ queryKey: ['kyc'] });
          }}
        />
      )}

      {showProductForm && (
        <ProductForm 
          onClose={() => setShowProductForm(false)}
          onSuccess={() => {
            setShowProductForm(false);
            queryClient.invalidateQueries({ queryKey: ['vendor-products'] });
          }}
        />
      )}

      {showImportModal && (
        <ImportProductsModal
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['vendor-products'] });
            queryClient.invalidateQueries({ queryKey: ['vendor-stats'] });
          }}
        />
      )}

      <Footer />
    </div>
  );
};

export default UserProfile;