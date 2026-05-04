/** @type {import('next').NextConfig} */
const nextConfig = {
    // (Optional) Export as a standalone site
    // See https://nextjs.org/docs/pages/api-reference/next-config-js/output#automatically-copying-traced-files
    output: 'standalone', // Feel free to modify/remove this option
    
    // Indicate that these packages should not be bundled by webpack
    experimental: {
        serverComponentsExternalPackages: ['sharp', 'onnxruntime-node'],
    },

    // Webpack configuration for @xenova/transformers
    webpack: (config, { isServer }) => {
        if (isServer) {
            config.externals.push({
                '@xenova/transformers': 'commonjs @xenova/transformers',
            });
        }
        
        // Ignore node-specific modules when bundling for the browser
        config.resolve.alias = {
            ...config.resolve.alias,
            'sharp$': false,
            'onnxruntime-node$': false,
        };
        
        return config;
    },
};

export default nextConfig;
