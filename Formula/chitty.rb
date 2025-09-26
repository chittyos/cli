class Chitty < Formula
  desc "ChittyOS CLI - Command-line interface with AI intelligence and system integration"
  homepage "https://chittyos.com/cli"
  url "https://github.com/chittyos/cli/archive/refs/tags/v2.1.1.tar.gz"
  sha256 ""
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", "--production"
    bin.install "chitty.js" => "chitty"
  end

  test do
    system "#{bin}/chitty", "--help"
  end
end