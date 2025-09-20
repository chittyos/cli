import UIKit
import Social
import MobileCoreServices
import UniformTypeIdentifiers

class ShareViewController: UIViewController {

    private var sharedText: String = ""
    private var sharedURL: URL?
    private var sharedImages: [UIImage] = []

    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        extractSharedData()
    }

    private func setupUI() {
        view.backgroundColor = .systemBackground

        let stackView = UIStackView()
        stackView.axis = .vertical
        stackView.spacing = 20
        stackView.translatesAutoresizingMaskIntoConstraints = false

        let titleLabel = UILabel()
        titleLabel.text = "Share To"
        titleLabel.font = .systemFont(ofSize: 20, weight: .semibold)
        titleLabel.textAlignment = .center

        let claudeButton = createShareButton(title: "Claude", icon: "💬", action: #selector(shareToClause))
        let gptButton = createShareButton(title: "ChatGPT", icon: "🤖", action: #selector(shareToGPT))
        let terminalButton = createShareButton(title: "Terminal", icon: "⌨️", action: #selector(shareToTerminal))
        let cancelButton = createShareButton(title: "Cancel", icon: "❌", action: #selector(cancel))

        stackView.addArrangedSubview(titleLabel)
        stackView.addArrangedSubview(claudeButton)
        stackView.addArrangedSubview(gptButton)
        stackView.addArrangedSubview(terminalButton)
        stackView.addArrangedSubview(cancelButton)

        view.addSubview(stackView)

        NSLayoutConstraint.activate([
            stackView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            stackView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            stackView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 40),
            stackView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -40)
        ])
    }

    private func createShareButton(title: String, icon: String, action: Selector) -> UIButton {
        let button = UIButton(type: .system)
        button.setTitle("\(icon) \(title)", for: .normal)
        button.titleLabel?.font = .systemFont(ofSize: 18)
        button.backgroundColor = .secondarySystemBackground
        button.layer.cornerRadius = 10
        button.heightAnchor.constraint(equalToConstant: 50).isActive = true
        button.addTarget(self, action: action, for: .touchUpInside)
        return button
    }

    private func extractSharedData() {
        guard let extensionItem = extensionContext?.inputItems.first as? NSExtensionItem,
              let attachments = extensionItem.attachments else {
            return
        }

        for attachment in attachments {
            if attachment.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                attachment.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { [weak self] (data, error) in
                    if let text = data as? String {
                        self?.sharedText = text
                    }
                }
            } else if attachment.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                attachment.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] (data, error) in
                    if let url = data as? URL {
                        self?.sharedURL = url
                    }
                }
            } else if attachment.hasItemConformingToTypeIdentifier(UTType.image.identifier) {
                attachment.loadItem(forTypeIdentifier: UTType.image.identifier, options: nil) { [weak self] (data, error) in
                    if let image = data as? UIImage {
                        self?.sharedImages.append(image)
                    } else if let url = data as? URL,
                              let imageData = try? Data(contentsOf: url),
                              let image = UIImage(data: imageData) {
                        self?.sharedImages.append(image)
                    }
                }
            }
        }
    }

    @objc private func shareToClause() {
        let content = prepareContent()

        // Try Claude iOS app first
        if let claudeURL = URL(string: "claude://new?text=\(content.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")") {
            openURL(claudeURL) { [weak self] success in
                if !success {
                    // Fallback to Claude web
                    if let webURL = URL(string: "https://claude.ai/new?q=\(content.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")") {
                        self?.openURL(webURL) { _ in
                            self?.completeRequest()
                        }
                    }
                } else {
                    self?.completeRequest()
                }
            }
        }
    }

    @objc private func shareToGPT() {
        let content = prepareContent()

        // Try ChatGPT app first
        if let gptURL = URL(string: "chatgpt://new?text=\(content.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")") {
            openURL(gptURL) { [weak self] success in
                if !success {
                    // Fallback to ChatGPT web
                    if let webURL = URL(string: "https://chat.openai.com/?q=\(content.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")") {
                        self?.openURL(webURL) { _ in
                            self?.completeRequest()
                        }
                    }
                } else {
                    self?.completeRequest()
                }
            }
        }
    }

    @objc private func shareToTerminal() {
        let content = prepareContent()

        // Create a temporary script file
        let tempDir = FileManager.default.temporaryDirectory
        let scriptFile = tempDir.appendingPathComponent("shared_content.txt")

        do {
            try content.write(to: scriptFile, atomically: true, encoding: .utf8)

            // Use x-terminal-emulator URL scheme or AppleScript
            let script = """
            tell application "Terminal"
                activate
                do script "cat '\(scriptFile.path)'"
            end tell
            """

            // Save AppleScript and execute
            let scriptURL = tempDir.appendingPathComponent("open_terminal.scpt")
            try script.write(to: scriptURL, atomically: true, encoding: .utf8)

            // Note: This would need to be executed on macOS, not iOS
            // For iOS, we'd need a different approach or a Terminal app that supports URL schemes

            showAlert(title: "Content Saved", message: "Content saved to: \(scriptFile.path)\nOpen Terminal manually to access it.")

        } catch {
            showAlert(title: "Error", message: "Failed to prepare content for Terminal")
        }
    }

    private func prepareContent() -> String {
        var content = ""

        if !sharedText.isEmpty {
            content += sharedText
        }

        if let url = sharedURL {
            if !content.isEmpty { content += "\n\n" }
            content += "URL: \(url.absoluteString)"
        }

        if !sharedImages.isEmpty {
            if !content.isEmpty { content += "\n\n" }
            content += "[Images: \(sharedImages.count) image(s) shared]"
        }

        return content.isEmpty ? "No content to share" : content
    }

    private func openURL(_ url: URL, completion: @escaping (Bool) -> Void) {
        // For iOS extension, we need to use the extension context to open URLs
        var responder: UIResponder? = self
        while responder != nil {
            if let application = responder as? UIApplication {
                application.open(url, options: [:], completionHandler: completion)
                return
            }
            responder = responder?.next
        }
        completion(false)
    }

    private func showAlert(title: String, message: String) {
        DispatchQueue.main.async { [weak self] in
            let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in
                self?.completeRequest()
            })
            self?.present(alert, animated: true)
        }
    }

    @objc private func cancel() {
        completeRequest()
    }

    private func completeRequest() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
}