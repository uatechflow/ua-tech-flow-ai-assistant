/**
 * UA TECH FLOW AI Assistant
 *
 * News API integration test
 *
 * Purpose:
 * Verify that external news API can be accessed
 * and data structure is compatible with our frontend.
 */

const NEWS_API = "https://uatechflow.org/api/news";


async function testNewsAPI() {

    console.log("=================================");
    console.log("UA TECH FLOW NEWS API TEST");
    console.log("=================================");


    try {

        console.log("\nConnecting to:");
        console.log(NEWS_API);


        const response = await fetch(NEWS_API);


        if (!response.ok) {
            throw new Error(
                `HTTP error: ${response.status}`
            );
        }


        const news = await response.json();


        console.log("\nAPI RESPONSE OK");
        console.log(
            "Total news received:",
            news.length
        );


        if (!Array.isArray(news)) {
            throw new Error(
                "API response is not an array"
            );
        }


        console.log("\nLatest news:");

        console.log("---------------------------------");


        /*
          Future logic:

          Frontend needs only 6 cards.

          Later we will:
          - sort by created_at
          - take first 6
          - cache them
        */


        const latestNews = news
            .sort(
                (a,b) =>
                new Date(b.created_at) -
                new Date(a.created_at)
            )
            .slice(0,6);



        latestNews.forEach((item,index)=>{

            console.log(
                `\n${index+1}. ${item.title}`
            );

            console.log(
                "Date:",
                item.created_at
            );

            console.log(
                "Image:",
                item.media_source
            );

            console.log(
                "Source:",
                item.source_url
            );

        });


        console.log("\n---------------------------------");
        console.log(
            "NEWS TEST FINISHED SUCCESSFULLY"
        );
        console.log("---------------------------------");


    }
    catch(error){

        console.error(
            "\nNEWS API TEST FAILED"
        );

        console.error(
            error.message
        );

        process.exit(1);

    }

}



testNewsAPI();