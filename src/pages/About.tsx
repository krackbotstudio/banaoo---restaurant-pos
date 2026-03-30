import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Target, Heart, Lightbulb, Users, ArrowRight } from "lucide-react";

const values = [
  {
    icon: Target,
    title: "Mission-Driven",
    description: "We're on a mission to make restaurant management accessible and efficient for everyone."
  },
  {
    icon: Heart,
    title: "Customer-First",
    description: "Every feature we build starts with understanding our customers' real needs."
  },
  {
    icon: Lightbulb,
    title: "Innovation",
    description: "We constantly push boundaries to bring the latest technology to your restaurant."
  },
  {
    icon: Users,
    title: "Community",
    description: "We believe in building a strong community of restaurant owners helping each other."
  }
];

export default function About() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      {/* Hero */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-primary/5 to-background">
        <div className="container text-center space-y-6 max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-bold">
            About banaoo.io
          </h1>
          <p className="text-muted-foreground text-lg">
            We're building the future of restaurant management, one feature at a time.
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
                banaoo.io was born out of frustration. As restaurant owners ourselves, we struggled 
                with clunky, expensive, and outdated POS systems that didn't meet our needs.
              </p>
              <p>
                In 2023, we decided to build something better. A system that's intuitive, affordable, 
                and powerful enough to handle everything from a small café to a multi-outlet restaurant chain.
              </p>
              <p>
                Today, banaoo.io serves hundreds of restaurants across the country, helping them 
                streamline operations, delight customers, and grow their businesses.
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
            Start your free trial today and see why hundreds of restaurants trust banaoo.io.
          </p>
          <Button size="lg" variant="secondary" asChild className="gap-2">
            <Link to="/auth">
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
