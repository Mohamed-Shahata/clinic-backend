import { Module } from "@nestjs/common";
import { SiteRatingController } from "./site-rating.controller";
import { SiteRatingService } from "./site-rating.service";

@Module({
  controllers: [SiteRatingController],
  providers: [SiteRatingService],
})
export class SiteRatingModule {}
