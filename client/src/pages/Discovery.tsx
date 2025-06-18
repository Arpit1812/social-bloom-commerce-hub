import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Grid, User, ShoppingBag } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import ProductCard from "@/components/ProductCard";

const Discovery = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const navigate = useNavigate();

  // Fetch products
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['discovery-products', searchTerm, selectedCategory],
    queryFn: async () => {
      let query = supabase
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
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (searchTerm) {
        query = query.ilike('name', `%${searchTerm}%`);
      }
      
      if (selectedCategory) {
        query = query.eq('category', selectedCategory);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      return data?.map(product => ({
        ...product,
        image_url: product.image_url || undefined,
        vendor_profile: product.vendor_profile ? {
          full_name: product.vendor_profile.full_name,
          email: product.vendor_profile.email
        } : null,
        vendor_kyc: product.vendor_profile?.vendor_kyc_data || []
      })) || [];
    },
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['discovery-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('category')
        .not('category', 'is', null)
        .eq('is_active', true);
      
      if (error) throw error;
      
      const uniqueCategories = Array.from(new Set(data.map(item => item.category)));
      return uniqueCategories.filter(Boolean);
    },
  });

  // Fetch users for search
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['discovery-users', searchTerm],
    queryFn: async () => {
      if (!searchTerm) return [];
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .limit(20);
      
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Instagram-style Search Header */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              placeholder="Search people and products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-3 text-lg border-gray-200 rounded-xl bg-white shadow-sm"
            />
          </div>
        </div>

        {/* Instagram-style Tabs */}
        <Tabs defaultValue="products" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6 bg-white rounded-xl">
            <TabsTrigger value="products" className="flex items-center gap-2 text-lg py-3">
              <Grid className="w-5 h-5" />
              Products
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2 text-lg py-3">
              <User className="w-5 h-5" />
              People
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="space-y-6">
            {/* Categories Section */}
            {categories.length > 0 && !searchTerm && (
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-4">Browse Categories</h2>
                <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-8 gap-3">
                  {categories.map((category) => {
                    const categoryProduct = products.find(p => p.category === category);
                    return (
                      <div
                        key={category}
                        className={`cursor-pointer rounded-xl overflow-hidden transition-all duration-300 hover:scale-105 ${
                          selectedCategory === category ? 'ring-2 ring-pink-500' : ''
                        }`}
                        onClick={() => setSelectedCategory(selectedCategory === category ? '' : category)}
                      >
                        <div className="aspect-square bg-gradient-to-br from-pink-100 to-rose-100 flex items-center justify-center relative">
                          {categoryProduct?.image_url ? (
                            <img 
                              src={categoryProduct.image_url} 
                              alt={category}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 bg-pink-200 rounded-full flex items-center justify-center">
                              <span className="text-pink-600 font-bold text-sm">
                                {category.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black bg-opacity-20 flex items-end">
                            <div className="w-full p-1 bg-gradient-to-t from-black to-transparent">
                              <p className="text-white text-xs font-medium text-center truncate">
                                {category}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Products Grid - Instagram style */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {productsLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="aspect-square bg-gray-200 rounded-xl animate-pulse" />
                ))
              ) : products.length > 0 ? (
                products.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))
              ) : (
                <div className="col-span-full text-center py-12">
                  <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">No products found</p>
                  {searchTerm && (
                    <p className="text-gray-400">Try searching for something else</p>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            {/* Users Grid - Instagram style */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {usersLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl p-4 animate-pulse">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gray-200 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4" />
                        <div className="h-3 bg-gray-200 rounded w-1/2" />
                      </div>
                    </div>
                  </div>
                ))
              ) : users.length > 0 ? (
                users.map((user) => (
                  <div
                    key={user.id}
                    className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => navigate(`/profile/${user.id}`)}
                  >
                    <div className="flex items-center space-x-4">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback>
                          {user.full_name ? user.full_name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">
                          {user.full_name || 'Unknown User'}
                        </p>
                        <p className="text-gray-500 text-sm truncate">
                          {user.email}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : searchTerm ? (
                <div className="col-span-full text-center py-12">
                  <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">No people found</p>
                  <p className="text-gray-400">Try searching for someone else</p>
                </div>
              ) : (
                <div className="col-span-full text-center py-12">
                  <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 text-lg">Start typing to search for people</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </Layout>
  );
};

export default Discovery;