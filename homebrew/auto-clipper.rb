cask "auto-clipper" do
  arch arm: "aarch64", intel: "x64"

  version "1.9.0"
  # Fill these in AFTER a release exists:
  #   shasum -a 256 "Auto.Clipper_1.9.0_aarch64.dmg"
  #   shasum -a 256 "Auto.Clipper_1.9.0_x64.dmg"
  sha256 arm:   "PLACEHOLDER_ARM64_SHA256",
         intel: "PLACEHOLDER_X64_SHA256"

  # IMPORTANT: this URL must match the ACTUAL asset name on the GitHub release.
  # GitHub sanitizes the space in the productName "Auto Clipper" to a period ".",
  # so the asset is expected to be "Auto.Clipper_<version>_<arch>.dmg".
  # Verify once with:  gh release view app-v#{version} --json assets --jq '.assets[].name'
  # and adjust the filename here if it differs (e.g. space "%20" or a hyphen).
  url "https://github.com/DhimasPH/auto-clipper/releases/download/app-v#{version}/Auto.Clipper_#{version}_#{arch}.dmg"
  name "Auto Clipper"
  desc "AI-powered automated video clipper and subtitler"
  homepage "https://github.com/DhimasPH/auto-clipper"

  livecheck do
    url :url
    strategy :github_latest
  end

  auto_updates true
  depends_on macos: ">= :monterey"

  app "Auto Clipper.app"

  zap trash: [
    "~/Library/Application Support/com.autoclipper.app",
    "~/Library/Caches/com.autoclipper.app",
    "~/Library/Saved Application State/com.autoclipper.app.savedState",
  ]
end
