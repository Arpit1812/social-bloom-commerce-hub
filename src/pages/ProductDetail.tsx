import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Heart, ShoppingCart, ArrowLeft, Users } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState } from "react";

const ProductDetail = () => {
  const { productId: id } = useParams(); // Changed: Use productId from params and alias as id
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [groupForm, setGroupForm] = useState({
    name: '',
    description: '',
  });

  // Fetch product details
  const { data: product, isLoading, error } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      if (!id) throw new Error('Product ID is required');
      
      console.log('Fetching product details for ID:', id);
      
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          vendor_profile:profiles!vendor_id (
            full_name,
            email,
            vendor_kyc_data:vendor_kyc!vendor_id (
              display_business_name,
              business_name
            )
          )
        `)
        .eq('id', id)
        .eq('is_active', true)
        .maybeSingle();
      
      if (error) {
        console.error('Error fetching product details:', error);
        throw error;
      }
      
      if (!data) {
        console.warn('Product not found in Supabase for ID:', id);
        throw new Error('Product not found');
      }
      
      console.log('Raw product data from Supabase:', data);
      
      const profileData = data.vendor_profile;
      const kycDataFromProfile = profileData?.vendor_kyc_data;
      
      const kycDataForCard = Array.isArray(kycDataFromProfile) 
        ? kycDataFromProfile 
        : (kycDataFromProfile ? [kycDataFromProfile] : []);

      const cleanVendorProfile = profileData ? {
        full_name: profileData.full_name,
        email: profileData.email
      } : null;

      const processedProduct = {
        ...data,
        vendor_profile: cleanVendorProfile,
        vendor_kyc: kycDataForCard
      };
      
      console.log('Processed product for detail page:', processedProduct);
      return processedProduct;
    },
    enabled: !!id,
  });

  // Fetch discount tiers for this product
  const { data: tiers } = useQuery({
    queryKey: ['product-tiers', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_discount_tiers')
        .select('*')
        .eq('product_id', id)
        .order('tier_number');

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Determine if tiers exist
  const hasTiers = tiers && tiers.length > 0;

  // Check if product is in wishlist
  const { data: isInWishlist = false } = useQuery({
    queryKey: ['wishlist-status', id, user?.id],
    queryFn: async () => {
      if (!user || !id) return false;
      
      const { data, error } = await supabase
        .from('wishlist')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', id)
        .maybeSingle();
      
      if (error) {
        console.error('Wishlist check error:', error);
        return false;
      }
      
      return !!data;
    },
    enabled: !!user && !!id,
  });

  // Wishlist mutations
  const addToWishlistMutation = useMutation({
    mutationFn: async () => {
      if (!user || !id) throw new Error('Please login to add to wishlist');
      
      const { error } = await supabase
        .from('wishlist')
        .insert({
          user_id: user.id,
          product_id: id
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist-status', id, user?.id] });
      queryClient.invalidateQueries({ queryKey: ['wishlist-count'] });
      toast({ title: "Added to wishlist" });
    },
    onError: (error: any) => {
      console.error('Add to wishlist error:', error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const removeFromWishlistMutation = useMutation({
    mutationFn: async () => {
      if (!user || !id) throw new Error('Please login');
      
      const { error } = await supabase
        .from('wishlist')
        .delete()
        .eq('user_id', user.id)
        .eq('product_id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist-status', id, user?.id] });
      queryClient.invalidateQueries({ queryKey: ['wishlist-count'] });
      toast({ title: "Removed from wishlist" });
    },
    onError: (error: any) => {
      console.error('Remove from wishlist error:', error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Add to cart mutation
  const addToCartMutation = useMutation({
    mutationFn: async () => {
      if (!user || !id) throw new Error('Please login to add to cart');
      
      const { data: existingItem } = await supabase
        .from('cart_items')
        .select('id, quantity')
        .eq('user_id', user.id)
        .eq('product_id', id)
        .maybeSingle();

      if (existingItem) {
        const { error } = await supabase
          .from('cart_items')
          .update({ quantity: existingItem.quantity + 1 })
          .eq('id', existingItem.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('cart_items')
          .insert({
            user_id: user.id,
            product_id: id,
            quantity: 1
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart-count'] });
      queryClient.invalidateQueries({ queryKey: ['cart-items'] });
      toast({ title: "Added to cart" });
    },
    onError: (error: any) => {
      console.error('Add to cart error:', error);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Create group mutation
  const createGroupMutation = useMutation({
    mutationFn: async () => {
      if (!user || !id) throw new Error('Please login to create a group');
      if (!product) throw new Error('Product data is not available'); // Added check
      
      console.log('Creating group with data:', {
        name: groupForm.name,
        description: groupForm.description,
        creator_id: user.id,
        product_id: product.id, // Use product.id here
      });
      
      const { data, error } = await supabase
        .from('groups')
        .insert({
          name: groupForm.name,
          description: groupForm.description,
          creator_id: user.id,
          product_id: product.id, // Ensure this is the correct product ID
        })
        .select()
        .single();
      
      if (error) {
        console.error('Group creation error:', error);
        throw error;
      }
      
      return data;
    },
    onSuccess: (data) => {
      console.log('Group created successfully:', data);
      setIsGroupDialogOpen(false);
      setGroupForm({ name: '', description: '' });
      toast({ title: "Group created successfully!" });
      navigate('/groups');
    },
    onError: (error: any) => {
      console.error('Create group error:', error);
      toast({ 
        title: "Error creating group", 
        description: error.message || "Please try again later",
        variant: "destructive" 
      });
    },
  });

  const handleWishlistToggle = () => {
    if (!user) {
      toast({ title: "Please login to add to wishlist" });
      return;
    }
    
    if (isInWishlist) {
      removeFromWishlistMutation.mutate();
    } else {
      addToWishlistMutation.mutate();
    }
  };

  const getVendorName = () => {
    if (product?.vendor_kyc && Array.isArray(product.vendor_kyc) && product.vendor_kyc.length > 0) {
      return product.vendor_kyc[0]?.display_business_name || 
             product.vendor_kyc[0]?.business_name;
    }
    return product?.vendor_profile?.full_name || 'Unknown Vendor';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            <div className="animate-pulse">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="h-96 bg-gray-200 rounded"></div>
                <div className="space-y-4">
                  <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-6 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-20 bg-gray-200 rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-6xl mx-auto">
            <div className="text-center py-12">
              <h1 className="text-2xl font-bold mb-4">{error ? 'Error loading product' : 'Product not found'}</h1>
              <p className="text-gray-600 mb-6">
                {error ? error.message : "The product you're looking for doesn't exist or has been removed."}
              </p>
              <Button onClick={() => navigate('/products')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Products
              </Button>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <div className="container mx-auto mt-20 px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <Button
            variant="ghost"
            onClick={() => navigate('/products')}
            className="mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Products
          </Button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Product Image */}
            <div className="relative">
              <img 
                src={product.image_url || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=600&h=600&fit=crop"}
                alt={product.name}
                className="w-full h-96 object-cover rounded-lg"
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-4 right-4 bg-white/80 hover:bg-white"
                onClick={handleWishlistToggle}
                disabled={addToWishlistMutation.isPending || removeFromWishlistMutation.isPending}
              >
                <Heart 
                  className={`w-5 h-5 ${isInWishlist ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} 
                />
              </Button>
            </div>

            {/* Product Details */}
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold mb-2">{product.name}</h1>
                <p className="text-lg text-pink-600">by {getVendorName()}</p>
                {product.category && (
                  <Badge variant="secondary" className="mt-2">
                    {product.category}
                  </Badge>
                )}
              </div>

              <div className="text-4xl font-bold text-gray-800">
                ${product.price}
              </div>

              {product.description && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Description</h3>
                  <p className="text-gray-600">{product.description}</p>
                </div>
              )}

              {product.stock_quantity !== null && (
                <div>
                  <span className="text-sm text-gray-500">
                    Stock: {product.stock_quantity} available
                  </span>
                </div>
              )}

              <div className="space-y-3">
                <Button
                  onClick={() => addToCartMutation.mutate()}
                  className="w-full bg-gradient-to-r from-pink-500 to-rose-400 hover:from-pink-600 hover:to-rose-500"
                  disabled={addToCartMutation.isPending}
                  size="lg"
                >
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  {addToCartMutation.isPending ? 'Adding...' : 'Add to Cart'}
                </Button>
                
                {hasTiers && (
                  <Dialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full border-pink-200 text-pink-600 hover:bg-pink-50"
                        size="lg"
                        disabled={!user} // Disable if user not logged in
                      >
                        <Users className="w-5 h-5 mr-2" />
                        Create Group for this Product
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create Group for {product.name}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="groupName">Group Name</Label>
                          <Input
                            id="groupName"
                            value={groupForm.name}
                            onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                            placeholder="Enter group name"
                          />
                        </div>
                        <div>
                          <Label htmlFor="groupDescription">Description</Label>
                          <Textarea
                            id="groupDescription"
                            value={groupForm.description}
                            onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                            placeholder="Describe your group"
                          />
                        </div>
                        <Button
                          onClick={() => {
                            if (!user) {
                              toast({ title: "Please login to create a group.", variant: "destructive"});
                              return;
                            }
                            createGroupMutation.mutate();
                          }}
                          className="w-full"
                          disabled={!groupForm.name || createGroupMutation.isPending || !user}
                        >
                          {createGroupMutation.isPending ? 'Creating...' : 'Create Group'}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default ProductDetail;
