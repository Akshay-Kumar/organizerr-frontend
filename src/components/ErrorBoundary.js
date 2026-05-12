import React from "react";
import "./ErrorBoundary.css"

class ErrorBoundary extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            hasError: false,
            error: null,
        };
    }

    static getDerivedStateFromError(error) {
        return {
            hasError: true,
            error,
        };
    }

    componentDidCatch(error, errorInfo) {

        console.error(
            "[ErrorBoundary]",
            error,
            errorInfo
        );
    }

    handleReload = () => {
        window.location.reload();
    };

    render() {

        if (this.state.hasError) {

            return (
                <div className="error-boundary">

                    <h2>
                        Something went wrong
                    </h2>

                    <p>
                        The dashboard encountered an unexpected error.
                    </p>

                    <pre className="error-message">
                        {String(this.state.error)}
                    </pre>

                    <button onClick={this.handleReload}>
                        Reload Dashboard
                    </button>

                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;