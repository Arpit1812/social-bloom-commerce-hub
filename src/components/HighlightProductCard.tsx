import { Button } from "@/components/ui/button";
import { ShoppingCart, Users, Heart } from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client"; // Adjust import path as needed

interface HighlightProductCardProps {
  product: {
    id: string;
    name: string;
    price: number;
    image_url?: string;
    category?: string;
    description?: string;
  };
  vendor: {
    id: string;
    full_name?: string;
    email: string;
  };
  index?: number;
}

const HighlightProductCard = ({ product, vendor, index }: HighlightProductCardProps) => {
  const navigate = useNavigate();
  const vendorName = vendor.full_name || vendor.email?.split("@")[0] || "Unknown Vendor";

  // Fetch discount tiers for this product
  const { data: tiers, isLoading } = useQuery({
    queryKey: ["product-tiers", product.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_discount_tiers")
        .select("discount_percentage")
        .eq("product_id", product.id)
        .order("tier_number");

      if (error) throw error;
      return data;
    },
    enabled: !!product.id,
  });

  // Determine if tiers exist and calculate max discount
  const hasTiers = tiers && tiers.length > 0;
  const maxDiscount = hasTiers
    ? Math.max(...tiers.map((tier) => tier.discount_percentage))
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: index * 0.05 }}
      className="group relative w-full"
    >
      {/* Main Card Container */}
      <div className="relative overflow-hidden rounded-2xl bg-white shadow-lg transition-all duration-500 hover:shadow-2xl hover:shadow-pink-300/50 hover:scale-[1.02]">
        {/* Optimized Image Container */}
        <div className="relative w-full aspect-[4/3] overflow-hidden bg-gray-100">
          <img
            src={
              product.image_url ||
              "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=500&h=600&fit=crop"
            }
            alt={product.name}
            className="w-full h-full object-cover transition-transform duration-700 cursor-pointer hover:scale-105"
            onClick={() => navigate(`/products/${product.id}`)}
            loading="lazy"
          />
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white/30 to-transparent" />
          <button className="absolute top-3 right-3 p-2 rounded-full bg-white/80 backdrop-blur-sm border border-white/50 transition-all duration-300 hover:bg-white/90 hover:scale-110">
            <Heart className="w-4 h-4 text-gray-600 hover:text-pink-500" />
          </button>
        </div>

        {/* Compact Content Area */}
        <div className="relative bg-white p-4 space-y-3">
          {/* Price and Category */}
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">₹{product.price}</h2>
            {product.category && (
              <span className="text-xs text-slate-500 uppercase tracking-wide font-medium bg-gray-100 px-2 py-1 rounded-md">
                {product.category}
              </span>
            )}
          </div>

          {/* Product Title and Description */}
          <div className="space-y-1">
            <h3 
              className="text-base font-semibold text-slate-800 leading-tight line-clamp-1 cursor-pointer hover:text-pink-600 transition-colors duration-200"
              onClick={() => navigate(`/products/${product.id}`)}
            >
              {product.name}
            </h3>
            <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
              {product.description || "Quality product perfect for group orders"}
            </p>
          </div>

          {/* Group Benefits Row - Fixed height, always shown */}
          <div className="flex items-center gap-6 py-2 min-h-[40px]"> {/* Fixed min-height for consistency */}
            <div className="text-center">
              <div className="text-sm font-bold text-slate-800">
                {isLoading ? "Loading..." : (hasTiers ? `${maxDiscount}%` : "N/A")}
              </div>
              <div className="text-xs text-slate-500 uppercase tracking-wide font-medium">Discount</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-slate-800">
                {isLoading ? "Loading..." : (hasTiers ? "Groups" : "N/A")}
              </div>
              <div className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                {hasTiers ? "Available" : ""}
              </div>
            </div>
          </div>

          {/* Vendor Info */}
          <div className="border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between text-sm mb-3">
              <span className="text-slate-500">
                Sold by{" "}
                <span 
                  className="text-pink-600 font-medium cursor-pointer hover:text-pink-700 transition-colors duration-200"
                  onClick={() => navigate(`/users/${vendor.id}`)}
                >
                  {vendorName}
                </span>
              </span>
            </div>

            {/* Action Buttons - Conditional based on tiers */}
            <div className="flex gap-2">
              <Button
                onClick={() => navigate(`/products/${product.id}`)}
                variant="outline"
                className={`h-9 border-slate-300 hover:border-slate-400 text-sm ${hasTiers ? "flex-1" : "w-full"}`}
              >
                <ShoppingCart className="w-4 h-4 mr-1" />
                Add to Cart
              </Button>
              {hasTiers && (
                <Button
                  onClick={() => navigate(`/products/${product.id}`)}
                  className="flex-1 bg-gradient-to-r from-pink-500 to-rose-400 hover:from-pink-600 hover:to-rose-500 text-white font-medium h-9 text-sm"
                >
                  <Users className="w-4 h-4 mr-1" />
                  Start Group Order
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Subtle glow effect */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-pink-500/5 to-rose-500/5 blur-xl -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
    </motion.div>
  );
};

export default HighlightProductCard;
