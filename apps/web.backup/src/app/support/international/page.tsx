/**
 * B241C-I18N-029: InternationalSupportDocs Page
 *
 * Support portal with language-specific FAQ, guides, and help articles;
 * automatically displays content based on locale; includes search and navigation;
 * shows fallback if translation unavailable
 */

'use client';

import { useState, useMemo } from 'react';
import { Search, Book, HelpCircle, FileText, ArrowRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LanguageAwareSearch, useLanguageAwareSearch } from '@/components/i18n/LanguageAwareSearch';
import { useTranslation, Translation } from '@/i18n';
import { cn } from '@/lib/utils';

interface SupportArticle {
  id: string;
  title: string;
  content: string;
  category: 'faq' | 'guide' | 'troubleshooting' | 'general';
  tags: string[];
  locale: string;
  lastUpdated: Date;
}

interface SupportCategory {
  id: string;
  name: string;
  icon: React.ReactNode;
  articles: SupportArticle[];
}

export default function InternationalSupportDocsPage() {
  const { locale, t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const { matches, highlight } = useLanguageAwareSearch();

  // Mock support articles (in production, these would come from a CMS or API)
  const allArticles: SupportArticle[] = useMemo(() => [
    {
      id: '1',
      title: t('support.faq.gettingStarted.title', 'Getting Started'),
      content: t('support.faq.gettingStarted.content', 'Learn how to get started with our platform...'),
      category: 'faq',
      tags: ['getting-started', 'basics'],
      locale: locale,
      lastUpdated: new Date(),
    },
    {
      id: '2',
      title: t('support.guide.accountSetup.title', 'Account Setup Guide'),
      content: t('support.guide.accountSetup.content', 'Step-by-step guide to setting up your account...'),
      category: 'guide',
      tags: ['account', 'setup'],
      locale: locale,
      lastUpdated: new Date(),
    },
    {
      id: '3',
      title: t('support.troubleshooting.loginIssues.title', 'Login Issues'),
      content: t('support.troubleshooting.loginIssues.content', 'Having trouble logging in? Here are some solutions...'),
      category: 'troubleshooting',
      tags: ['login', 'authentication'],
      locale: locale,
      lastUpdated: new Date(),
    },
  ], [locale, t]);

  // Group articles by category
  const categories: SupportCategory[] = useMemo(() => {
    const grouped = allArticles.reduce((acc, article) => {
      if (!acc[article.category]) {
        acc[article.category] = [];
      }
      acc[article.category].push(article);
      return acc;
    }, {} as Record<string, SupportArticle[]>);

    return [
      {
        id: 'faq',
        name: t('support.categories.faq', 'Frequently Asked Questions'),
        icon: <HelpCircle className="h-5 w-5" />,
        articles: grouped.faq || [],
      },
      {
        id: 'guide',
        name: t('support.categories.guides', 'Guides'),
        icon: <Book className="h-5 w-5" />,
        articles: grouped.guide || [],
      },
      {
        id: 'troubleshooting',
        name: t('support.categories.troubleshooting', 'Troubleshooting'),
        icon: <FileText className="h-5 w-5" />,
        articles: grouped.troubleshooting || [],
      },
    ];
  }, [allArticles, t]);

  // Filter articles based on search and category
  const filteredArticles = useMemo(() => {
    let articles = allArticles;

    // Filter by category
    if (selectedCategory) {
      articles = articles.filter((a) => a.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      articles = articles.filter(
        (article) =>
          matches(article.title, searchQuery) ||
          matches(article.content, searchQuery) ||
          article.tags.some((tag) => matches(tag, searchQuery))
      );
    }

    return articles;
  }, [allArticles, selectedCategory, searchQuery, matches]);

  // Check if article has translation
  const hasTranslation = (article: SupportArticle): boolean => {
    return article.locale === locale;
  };

  // Get fallback article (English)
  const getFallbackArticle = (article: SupportArticle): SupportArticle | null => {
    if (article.locale === 'en-US') return null;
    return allArticles.find((a) => a.id === article.id && a.locale === 'en-US') || null;
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          <Translation keyPath="support.title" fallback="Support Center" />
        </h1>
        <p className="text-muted-foreground">
          <Translation keyPath="support.description" fallback="Find answers to your questions" />
        </p>
      </div>

      {/* Search */}
      <div className="mb-8">
        <LanguageAwareSearch
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={t('support.searchPlaceholder', 'Search for help articles...')}
          className="max-w-2xl"
        />
      </div>

      {/* Categories */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedCategory === null ? 'default' : 'outline'}
            onClick={() => setSelectedCategory(null)}
          >
            {t('support.allCategories', 'All Categories')}
          </Button>
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? 'default' : 'outline'}
              onClick={() => setSelectedCategory(category.id)}
            >
              {category.icon}
              <span className="ml-2">{category.name}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Articles */}
      <div className="space-y-6">
        {filteredArticles.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {t('support.noResults', 'No articles found. Try a different search.')}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredArticles.map((article) => {
            const hasTranslationForArticle = hasTranslation(article);
            const fallback = !hasTranslationForArticle ? getFallbackArticle(article) : null;

            return (
              <Card key={article.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="mb-2">
                        {searchQuery ? (
                          <span>{highlight(article.title, searchQuery)}</span>
                        ) : (
                          article.title
                        )}
                        {!hasTranslationForArticle && fallback && (
                          <Badge variant="outline" className="ml-2">
                            {t('support.fallback', 'English')}
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {searchQuery ? (
                          <span>{highlight(article.content.substring(0, 150), searchQuery)}...</span>
                        ) : (
                          `${article.content.substring(0, 150)}...`
                        )}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="ml-4">
                      {categories.find((c) => c.id === article.category)?.name || article.category}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-2">
                      {article.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <Button variant="ghost" size="sm">
                      {t('support.readMore', 'Read More')}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Fallback notice */}
      {allArticles.some((a) => !hasTranslation(a)) && (
        <Card className="mt-8 border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20">
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">
              <Translation
                keyPath="support.fallbackNotice"
                fallback="Some articles are only available in English. We're working on translations."
              />
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

