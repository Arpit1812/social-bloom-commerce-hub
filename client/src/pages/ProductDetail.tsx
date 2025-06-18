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
    targetMembers: 2,
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
      setGroupForm({ name: '', description: '', targetMembers: 2 });
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
      <div className="container mx-auto px-4 py-8">
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

              {/* Pricing Section with Two Options */}
              <div className="space-y-4">
                {/* Single Purchase Price */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">Single Purchase</h3>
                      <p className="text-sm text-gray-600">Buy now, ships immediately</p>
                    </div>
                    <div className="text-2xl font-bold text-gray-800">
                      ${product.price}
                    </div>
                  </div>
                </div>

                {/* Group Shopping Price */}
                <div className="border-2 border-pink-300 rounded-lg p-4 bg-gradient-to-r from-pink-50 to-rose-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold text-pink-600">Group Shopping</h3>
                        <Badge variant="outline" className="text-pink-600 border-pink-300">
                          Up to 20% OFF
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">Team up with friends for extra savings! Groups expire in 24 hours.</p>
                      
                      {/* Default Discount Options */}
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-4 text-sm">
                          <span className="font-medium">2 members: 10% OFF</span>
                          <span className="text-pink-600 font-bold">${(product.price * 0.9).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="font-medium">3 members: 15% OFF</span>
                          <span className="text-pink-600 font-bold">${(product.price * 0.85).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="font-medium">5+ members: 20% OFF</span>
                          <span className="text-pink-600 font-bold">${(product.price * 0.8).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
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
                {/* Single Purchase Button */}
                <Button
                  onClick={() => addToCartMutation.mutate()}
                  className="w-full bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800"
                  disabled={addToCartMutation.isPending}
                  size="lg"
                >
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  {addToCartMutation.isPending ? 'Adding...' : 'Buy Now - Single Purchase'}
                </Button>
                
                {/* Group Shopping Button */}
                <Dialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      className="w-full bg-gradient-to-r from-pink-500 to-rose-400 hover:from-pink-600 hover:to-rose-500"
                      size="lg"
                      disabled={!user}
                    >
                      <Users className="w-5 h-5 mr-2" />
                      Start Group Shopping - Up to 20% OFF
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Start Group Shopping for {product.name}</DialogTitle>
                      <p className="text-sm text-gray-600">
                        Choose your target group size and get friends to join within 24 hours!
                      </p>
                    </DialogHeader>
                    <div className="space-y-4">
                      {/* Member Target Selection */}
                      <div>
                        <Label>Select your target discount</Label>
                        <div className="grid gap-2 mt-2">
                          <div 
                            className={`p-3 border rounded-lg cursor-pointer transition-all ${
                              groupForm.targetMembers === 2 
                                ? 'border-pink-500 bg-pink-50' 
                                : 'border-gray-200 hover:border-pink-300'
                            }`}
                            onClick={() => setGroupForm({ ...groupForm, targetMembers: 2 })}
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-medium">2 members</span>
                              <div className="text-right">
                                <div className="text-sm font-bold text-pink-600">10% OFF</div>
                                <div className="text-xs text-gray-500">
                                  ${(product.price * 0.9).toFixed(2)} each
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div 
                            className={`p-3 border rounded-lg cursor-pointer transition-all ${
                              groupForm.targetMembers === 3 
                                ? 'border-pink-500 bg-pink-50' 
                                : 'border-gray-200 hover:border-pink-300'
                            }`}
                            onClick={() => setGroupForm({ ...groupForm, targetMembers: 3 })}
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-medium">3 members</span>
                              <div className="text-right">
                                <div className="text-sm font-bold text-pink-600">15% OFF</div>
                                <div className="text-xs text-gray-500">
                                  ${(product.price * 0.85).toFixed(2)} each
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div 
                            className={`p-3 border rounded-lg cursor-pointer transition-all ${
                              groupForm.targetMembers === 5 
                                ? 'border-pink-500 bg-pink-50' 
                                : 'border-gray-200 hover:border-pink-300'
                            }`}
                            onClick={() => setGroupForm({ ...groupForm, targetMembers: 5 })}
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-medium">5 members</span>
                              <div className="text-right">
                                <div className="text-sm font-bold text-pink-600">20% OFF</div>
                                <div className="text-xs text-gray-500">
                                  ${(product.price * 0.8).toFixed(2)} each
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="groupName">Group Name</Label>
                        <Input
                          id="groupName"
                          value={groupForm.name}
                          onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                          placeholder="e.g., Sarah's Shopping Squad"
                        />
                      </div>
                      <div>
                        <Label htmlFor="groupDescription">Description (Optional)</Label>
                        <Textarea
                          id="groupDescription"
                          value={groupForm.description}
                          onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                          placeholder="Tell your friends what this group is about..."
                          rows={3}
                        />
                      </div>
                      
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => setIsGroupDialogOpen(false)}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={() => {
                            if (!user) {
                              toast({ title: "Please login to create a group.", variant: "destructive"});
                              return;
                            }
                            createGroupMutation.mutate();
                          }}
                          className="flex-1 bg-gradient-to-r from-pink-500 to-rose-400 hover:from-pink-600 hover:to-rose-500"
                          disabled={!groupForm.name || createGroupMutation.isPending || !user}
                        >
                          {createGroupMutation.isPending ? 'Creating...' : 'Create Group'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
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
