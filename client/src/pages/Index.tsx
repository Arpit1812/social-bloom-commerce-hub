
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import GroupsPreview from "@/components/GroupsPreview";
import Footer from "@/components/Footer";

const Index = () => {
  const navigate = useNavigate();

  // Fetch featured products
  const { data: featuredProducts = [] } = useQuery({
    queryKey: ['featured-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          vendor_profile:profiles!vendor_id (
            full_name,
            email
          )
        `)
        .eq('is_active', true)
        .limit(8)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen">
      <Header />
      <Hero />
      
      {/* Featured Products Section */}
      <section className="py-20 bg-gradient-to-b from-pink-50 to-white">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Featured Products</h2>
            <p className="text-xl text-gray-600">Discover amazing products from our community</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {featuredProducts.map((product) => (
              <div key={product.id} className="smooth-card overflow-hidden floating-card animate-fade-in">
                <div className="relative group">
                  <img 
                    src={product.image_url || "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=300&h=300&fit=crop"}
                    alt={product.name}
                    className="w-full h-48 object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
                    onClick={() => navigate(`/products/${product.id}`)}
                  />
                </div>
                
                <div className="p-4">
                  <h3 
                    className="font-semibold mb-1 text-gray-800 cursor-pointer hover:text-pink-600"
                    onClick={() => navigate(`/products/${product.id}`)}
                  >
                    {product.name}
                  </h3>
                  <p className="text-sm text-pink-600 mb-2">
                    by {product.vendor_profile?.full_name || product.vendor_profile?.email?.split('@')[0] || 'Unknown Vendor'}
                  </p>
                  
                  <div className="flex items-center mb-2">
                    <div className="flex items-center">
                      <Star className="w-4 h-4 text-yellow-400 fill-current" />
                      <span className="text-sm text-gray-600 ml-1">4.5</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-lg font-bold text-gray-800">${product.price}</span>
                  </div>
                  
                  <Button
                    onClick={() => navigate(`/products/${product.id}`)}
                    className="w-full social-button bg-gradient-to-r from-pink-500 to-rose-400 hover:from-pink-600 hover:to-rose-500"
                  >
                    View Product
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Button 
              onClick={() => navigate("/products")}
              size="lg"
              className="social-button bg-gradient-to-r from-pink-500 to-rose-400 hover:from-pink-600 hover:to-rose-500"
            >
              View All Products
            </Button>
          </div>
        </div>
      </section>

      <GroupsPreview />
      <Footer />
    </div>
  );
};

export default Index;
