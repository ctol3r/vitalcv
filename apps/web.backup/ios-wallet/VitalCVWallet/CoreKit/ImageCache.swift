//
//  ImageCache.swift
//  VitalCVWallet
//
//  Created: ARC A - Task 25
//  Image caching for issuer logos
//

import Foundation
import UIKit
import SwiftUI

/// ImageCache - LRU cache for issuer logos
class ImageCache {
    static let shared = ImageCache()

    private let cache = NSCache<NSString, UIImage>()
    private let maxCacheSize = 50 * 1024 * 1024 // 50MB

    private init() {
        cache.totalCostLimit = maxCacheSize
        cache.countLimit = 100
    }

    // MARK: - Task 25: Image Caching

    func image(for urlString: String) -> UIImage? {
        return cache.object(forKey: urlString as NSString)
    }

    func setImage(_ image: UIImage, for urlString: String) {
        let cost = image.size.width * image.size.height * 4 // Rough memory cost
        cache.setObject(image, forKey: urlString as NSString, cost: Int(cost))
    }

    func removeImage(for urlString: String) {
        cache.removeObject(forKey: urlString as NSString)
    }

    func clearCache() {
        cache.removeAllObjects()
    }
}

/// AsyncImage with caching
struct CachedAsyncImage<Content: View, Placeholder: View>: View {
    let url: URL?
    let content: (Image) -> Content
    let placeholder: () -> Placeholder

    @State private var image: UIImage?
    @State private var isLoading = false

    init(
        url: URL?,
        @ViewBuilder content: @escaping (Image) -> Content,
        @ViewBuilder placeholder: @escaping () -> Placeholder
    ) {
        self.url = url
        self.content = content
        self.placeholder = placeholder
    }

    var body: some View {
        Group {
            if let image = image {
                content(Image(uiImage: image))
            } else {
                placeholder()
                    .onAppear {
                        loadImage()
                    }
            }
        }
    }

    private func loadImage() {
        guard let url = url, !isLoading else { return }
        isLoading = true

        let urlString = url.absoluteString

        // Check cache first
        if let cachedImage = ImageCache.shared.image(for: urlString) {
            self.image = cachedImage
            isLoading = false
            return
        }

        // Load from network
        URLSession.shared.dataTask(with: url) { data, _, _ in
            guard let data = data, let loadedImage = UIImage(data: data) else {
                DispatchQueue.main.async {
                    self.isLoading = false
                }
                return
            }

            // Cache the image
            ImageCache.shared.setImage(loadedImage, for: urlString)

            DispatchQueue.main.async {
                self.image = loadedImage
                self.isLoading = false
            }
        }.resume()
    }
}

