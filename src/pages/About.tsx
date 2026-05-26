import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Target, Heart, Lightbulb, Users, ArrowRight } from "lucide-react";
import { SEO, StructuredData, buildBreadcrumbList } from "@/components/seo/SEO";

const values = [
  {
    icon: Heart,
    title: "Customer-Centric",
    description:
      "Our customers, their problems, and the product experience they deserve sit at the centre of every decision we make.",
  },
  {
    icon: Target,
    title: "Problem Solvers",
    description:
      "We listen first, then build. Every feature exists to remove a real friction point restaurant teams face every day.",
  },
  {
    icon: Lightbulb,
    title: "Emerging Tech",
    description:
      "We embrace modern tools and thoughtful engineering to craft software that is fast, reliable, and built for how food businesses actually work.",
  },
  {
    icon: Users,
    title: "Food Industry at Heart",
    description:
      "We have always been drawn to the food industry—its pace, its people, and the complex operational puzzles behind every great meal served.",
  },
];

export default function About() {
  return (
    <div className="min-h-screen flex flex-col">
      <SEO
        title="About banaoo"
        description="Meet the team behind banaoo — restaurant operators and engineers building a modern POS and management platform for Indian restaurants, cloud kitchens, QSRs and self-service counters."
        path="/about"
      />
      <StructuredData
        data={buildBreadcrumbList([
          { name: "Home", path: "/" },
          { name: "About", path: "/about" },
        ])}
      />
      <Navbar />
      
      {/* Hero */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-primary/5 to-background">
        <div className="container text-center space-y-6 max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-bold">
            About banaoo.io
          </h1>
          <p className="text-muted-foreground text-lg">
            Passionate problem solvers building meaningful technology for restaurants and food businesses.
          </p>
        </div>
      </section>

      {/* Story */}
      <section className="py-16">
        <div className="container max-w-4xl">
          <div className="space-y-6 text-center">
            <h2 className="text-2xl md:text-3xl font-bold">Our Story</h2>
            <div className="text-muted-foreground space-y-4 text-left md:text-center">
              <p>
                banaoo.io began with a simple obsession: the food industry is full of talented
                people held back by messy tools, fragmented workflows, and software that was never
                designed around how a real service floor actually runs.
              </p>
              <p>
                We are passionate problem solvers who have always been keen on this space. We love
                untangling complex operational challenges and turning them into clear, effective
                product experiences powered by emerging technology.
              </p>
              <p>
                Our product thinking, roadmap, and day-to-day work revolve around one question: what
                problem is our customer facing right now, and how do we solve it in a way that feels
                simple on the surface and dependable underneath?
              </p>
              <p>
                banaoo.io helps restaurants run orders, kitchens, billing, and customer-facing flows
                with software that stays customer-centric—because your success is the measure of ours.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 bg-muted/30">
        <div className="container">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">Our Values</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {values.map((value) => (
              <Card key={value.title} className="text-center">
                <CardContent className="pt-6 space-y-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <value.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg">{value.title}</h3>
                  <p className="text-muted-foreground text-sm">{value.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="space-y-2">
              <div className="text-3xl md:text-4xl font-bold text-primary">500+</div>
              <div className="text-muted-foreground">Restaurants</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl md:text-4xl font-bold text-primary">1M+</div>
              <div className="text-muted-foreground">Orders Processed</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl md:text-4xl font-bold text-primary">50+</div>
              <div className="text-muted-foreground">Cities</div>
            </div>
            <div className="space-y-2">
              <div className="text-3xl md:text-4xl font-bold text-primary">99.9%</div>
              <div className="text-muted-foreground">Uptime</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-primary text-primary-foreground">
        <div className="container text-center space-y-6">
          <h2 className="text-2xl md:text-3xl font-bold">
            Ready to Join Us?
          </h2>
          <p className="text-primary-foreground/80 max-w-xl mx-auto">
            Start your free trial today and see how a product built around your problems can work for your restaurant.
          </p>
          <Button size="lg" variant="secondary" asChild className="gap-2">
            <Link to="/auth?mode=signup">
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
