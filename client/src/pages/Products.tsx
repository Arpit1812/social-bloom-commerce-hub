import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Filter, Grid, User } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ProductCard from "@/components/ProductCard";

const Products = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");

  // Fetch products
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', searchTerm, selectedCategory],
    queryFn: async () => {
      console.log('Fetching products with searchTerm:', searchTerm, 'category:', selectedCategory);
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
      
      if (error) {
        console.error('Error fetching products:', error.message, error.details, error.hint);
        throw error;
      }
      
      console.log('Raw products data from Supabase:', data);
      
      const processedProducts = (data || []).map(product => {
        const profileData = product.vendor_profile;
        const kycDataFromProfile = profileData?.vendor_kyc_data || [];
        
        // Ensure kycDataForCard is always an array
        const kycDataForCard = Array.isArray(kycDataFromProfile) 
          ? kycDataFromProfile 
          : (kycDataFromProfile ? [kycDataFromProfile] : []);

        // Create a clean vendor_profile object for the card, without vendor_kyc_data nested inside
        const cleanVendorProfile = profileData ? {
          full_name: profileData.full_name,
          email: profileData.email
        } : null;

        return {
          ...product, // original product fields from 'products' table
          vendor_profile: cleanVendorProfile, // Pass the cleaned profile
          vendor_kyc: kycDataForCard // Pass the extracted and formatted KYC data
        };
      });
      
      console.log('Processed products for display:', processedProducts);
      return processedProducts;
    },
  });

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['product-categories'],
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
  const { data: users = [] } = useQuery({
    queryKey: ['users', searchTerm],
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

  console.log('Products state:', { products, isLoading });

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-4">Discovery</h1>
            <p className="text-xl text-gray-600">Discover amazing products from our community</p>
          </div>

          {/* Categories Section */}
          {categories.length > 0 && (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">Browse Categories</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {categories.map((category) => {
                  const categoryProduct = products.find(p => p.category === category);
                  return (
                    <div
                      key={category}
                      className={`cursor-pointer rounded-lg overflow-hidden transition-all duration-300 hover:scale-105 ${
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
                          <div className="w-12 h-12 bg-pink-200 rounded-full flex items-center justify-center">
                            <span className="text-pink-600 font-bold text-lg">
                              {category.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black bg-opacity-20 flex items-end">
                          <div className="w-full p-2 bg-gradient-to-t from-black to-transparent">
                            <p className="text-white text-sm font-medium text-center truncate">
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

          {/* Search and Filter */}
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-md bg-white"
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategory("");
                }}
              >
                <Filter className="w-4 h-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>

          {/* Products Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="smooth-card animate-pulse">
                  <div className="h-48 bg-gray-200 rounded mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No products found</h3>
              <p className="text-gray-500">Try adjusting your search or filters</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Products;
