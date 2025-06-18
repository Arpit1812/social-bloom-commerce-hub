
import { Heart, Users, ShoppingBag } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-gradient-to-r from-pink-50 to-rose-50 border-t border-pink-100">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-pink-400 to-rose-500 rounded-2xl flex items-center justify-center">
                <Heart className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-bold gradient-text">SocialShop</span>
            </div>
            <p className="text-gray-600 mb-6 max-w-md">
              The social e-commerce platform where communities come together to discover, share, and shop their favorite products with friends and family.
            </p>
            <div className="flex space-x-4">
              <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-md hover:shadow-lg transition-shadow cursor-pointer">
                <span className="text-pink-500 font-bold">f</span>
              </div>
              <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-md hover:shadow-lg transition-shadow cursor-pointer">
                <span className="text-pink-500 font-bold">@</span>
              </div>
              <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-md hover:shadow-lg transition-shadow cursor-pointer">
                <span className="text-pink-500 font-bold">in</span>
              </div>
            </div>
          </div>
          
          <div>
            <h3 className="font-semibold text-gray-800 mb-4">Platform</h3>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-600 hover:text-pink-500 transition-colors">How it Works</a></li>
              <li><a href="#" className="text-gray-600 hover:text-pink-500 transition-colors">For Vendors</a></li>
              <li><a href="#" className="text-gray-600 hover:text-pink-500 transition-colors">For Users</a></li>
              <li><a href="#" className="text-gray-600 hover:text-pink-500 transition-colors">Admin Dashboard</a></li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-gray-800 mb-4">Support</h3>
            <ul className="space-y-2">
              <li><a href="#" className="text-gray-600 hover:text-pink-500 transition-colors">Help Center</a></li>
              <li><a href="#" className="text-gray-600 hover:text-pink-500 transition-colors">Contact Us</a></li>
              <li><a href="#" className="text-gray-600 hover:text-pink-500 transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="text-gray-600 hover:text-pink-500 transition-colors">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-pink-200 mt-8 pt-8 text-center">
          <p className="text-gray-600">© 2024 SocialShop. Made with love for connecting communities through commerce.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
