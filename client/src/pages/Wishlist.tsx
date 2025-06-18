
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, ShoppingCart, Trash2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const Wishlist = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch wishlist items
  const { data: wishlistItems = [], isLoading } = useQuery({
    queryKey: ['wishlist', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('wishlist')
        .select(`
          *,
          products (
            *,
            vendor_profile:profiles!vendor_id (
              full_name,
              email
            ),
            vendor_kyc:vendor_kyc!vendor_id (
              display_business_name,
              business_name
            )
          )
        `)
        .eq('user_id', user.id)
        .order('added_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Remove from wishlist mutation
  const removeFromWishlistMutation = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase
        .from('wishlist')
        .delete()
        .eq('user_id', user?.id)
        .eq('product_id', productId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishlist'] });
      toast({ title: "Removed from wishlist" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Add to cart mutation
  const addToCartMutation = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase
        .from('cart_items')
        .insert({
          user_id: user?.id,
          product_id: productId,
          quantity: 1
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart-count'] });
      toast({ title: "Added to cart" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const calculateTotal = () => {
    return wishlistItems.reduce((sum, item) => sum + (item.products?.price || 0), 0);
  };

  const handleCheckout = () => {
    // Add all wishlist items to cart and navigate to cart
    wishlistItems.forEach(item => {
      if (item.products?.id) {
        addToCartMutation.mutate(item.products.id);
      }
    });
    navigate('/cart');
  };

  const getVendorName = (product: any) => {
    if (Array.isArray(product?.vendor_kyc) && product.vendor_kyc.length > 0) {
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
          <div className="text-center">Loading your wishlist...</div>
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
          <div className="flex items-center mb-6">
            <Button
              variant="ghost"
              onClick={() => navigate(-1)}
              className="mr-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <h1 className="text-3xl font-bold">My Wishlist</h1>
          </div>

          {wishlistItems.length === 0 ? (
            <div className="text-center py-12">
              <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">Your wishlist is empty</h3>
              <p className="text-gray-500 mb-4">Start adding products you love!</p>
              <Button onClick={() => navigate('/products')}>
                Browse Products
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {wishlistItems.map((item) => (
                  <Card key={item.id} className="overflow-hidden">
                    <div className="relative">
                      <img 
                        src={item.products?.image_url || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=300&h=300&fit=crop"}
                        alt={item.products?.name}
                        className="w-full h-48 object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                        onClick={() => navigate(`/products/${item.products?.id}`)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 bg-white/80 hover:bg-white"
                        onClick={() => removeFromWishlistMutation.mutate(item.products?.id)}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                    
                    <CardContent className="p-4">
                      <h3 
                        className="font-semibold mb-1 cursor-pointer hover:text-pink-600"
                        onClick={() => navigate(`/products/${item.products?.id}`)}
                      >
                        {item.products?.name}
                      </h3>
                      <p className="text-sm text-pink-600 mb-2">
                        by {getVendorName(item.products)}
                      </p>
                      
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-lg font-bold text-gray-800">${item.products?.price}</span>
                      </div>
                      
                      <Button
                        onClick={() => addToCartMutation.mutate(item.products?.id)}
                        className="w-full bg-gradient-to-r from-pink-500 to-rose-400 hover:from-pink-600 hover:to-rose-500"
                        disabled={addToCartMutation.isPending}
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Add to Cart
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="bg-gray-50 p-6 rounded-lg">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-semibold">Wishlist Summary</h3>
                  <span className="text-2xl font-bold">${calculateTotal().toFixed(2)}</span>
                </div>
                <Button
                  onClick={handleCheckout}
                  className="w-full bg-gradient-to-r from-pink-500 to-rose-400 hover:from-pink-600 hover:to-rose-500"
                  disabled={addToCartMutation.isPending}
                >
                  Add All to Cart & Checkout
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Wishlist;
