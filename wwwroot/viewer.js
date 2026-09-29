/// import * as Autodesk from "@types/forge-viewer";

async function getAccessToken(callback) {
    try {
        const resp = await fetch('/api/auth/token');
        if (!resp.ok) {
            throw new Error(await resp.text());
        }
        const { access_token, expires_in } = await resp.json();
        callback(access_token, expires_in);
    } catch (err) {
        alert('Could not obtain access token. See the console for more details.');
        console.error(err);
    }
}

export function initViewer(container) {
    return new Promise(function (resolve, reject) {
        Autodesk.Viewing.Initializer({ env: 'AutodeskProduction', getAccessToken }, function () {
            const config = {
                extensions: ['Autodesk.DocumentBrowser']
            };
            const viewer = new Autodesk.Viewing.GuiViewer3D(container, config);
            viewer.start();
            viewer.setTheme('light-theme');
            resolve(viewer);
        });
    });
}

export function loadModel(viewer, urn) {
    return new Promise(function (resolve, reject) {

        function onDocumentLoadSuccess(doc) {
            const root = doc.getRoot();

            // Find available 3D geometry
            const views3D = root.search({
                type: 'geometry',
                role: '3d'
            });

            // Open 3D first, otherwise fall back to Autodesk's default view
            const viewable = views3D.length > 0
                ? views3D[0]
                : root.getDefaultGeometry();

            viewer.loadDocumentNode(doc, viewable).then((model) => {
    makeEnvelopeTransparent(viewer, model);
    resolve(model);
});
        }

        function onDocumentLoadFailure(code, message, errors) {
            reject({ code, message, errors });
        }

        viewer.setLightPreset(0);

        Autodesk.Viewing.Document.load(
            'urn:' + urn,
            onDocumentLoadSuccess,
            onDocumentLoadFailure
        );
    });
}

function makeEnvelopeTransparent(viewer, model) {
    const tree = model.getInstanceTree();
    const rootId = tree.getRootId();
    const dbIds = [];

    function collect(dbId) {
        let hasChildren = false;

        tree.enumNodeChildren(dbId, (childId) => {
            hasChildren = true;
            collect(childId);
        });

        if (!hasChildren) {
            dbIds.push(dbId);
        }
    }

    collect(rootId);

    model.getBulkProperties(
        dbIds,
        {
            propFilter: ['Category']
        },
        (results) => {
            const transparentColor = new THREE.Vector4(1, 1, 1, 0.18);

            for (const item of results) {
                const categoryProp = item.properties?.find(
                    p => p.displayName === 'Category'
                );

                const category = categoryProp?.displayValue || '';

                if (
                    category.includes('Walls') ||
                    category.includes('Roofs')
                ) {
                    model.setThemingColor(item.dbId, transparentColor);
                }
            }

            viewer.impl.invalidate(true);
        }
    );
}